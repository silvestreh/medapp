import asyncio
import io
import logging
import os
import threading
import time
import uuid
from typing import Any

from dotenv import load_dotenv

load_dotenv()

import av
import cv2
import numpy as np
import requests as http_requests
from deepface import DeepFace
from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, HttpUrl

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_KEY = os.environ.get("API_KEY", "")
UPLOADS_API_KEY = os.environ.get("UPLOADS_API_KEY", "")

app = FastAPI(title="Face Compare Service")

api_key_header = APIKeyHeader(name="x-api-key")


def _verify_api_key(key: str = Security(api_key_header)) -> str:
    if not API_KEY:
        raise HTTPException(status_code=500, detail="API_KEY not configured")
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return key


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class CompareRequest(BaseModel):
    id_url: HttpUrl
    video_url: HttpUrl


class AsyncCompareRequest(CompareRequest):
    progress_url: HttpUrl
    verification_id: str
    callback_key: str


class FrameResult(BaseModel):
    frame: int
    verified: bool
    distance: float
    similarity_percent: float


class CompareResponse(BaseModel):
    verified: bool
    distance: float
    similarity_percent: float
    frames_analyzed: int
    frames_matched: int
    per_frame: list[FrameResult]


class JobSubmitResponse(BaseModel):
    job_id: str
    queue_position: int


# ---------------------------------------------------------------------------
# Job queue infrastructure
# ---------------------------------------------------------------------------

jobs: dict[str, dict[str, Any]] = {}
jobs_lock = threading.Lock()
job_queue: asyncio.Queue[str] = asyncio.Queue()

# Ordered list of queued job IDs for position tracking
queued_job_ids: list[str] = []
queued_lock = threading.Lock()

JOB_TTL_SECONDS = 3600  # Clean up finished jobs after 1 hour


def _send_progress(
    job: dict[str, Any],
    step: str,
    current: int | None = None,
    total: int | None = None,
    position: int | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    """POST a progress update to the callback URL with retries."""
    payload: dict[str, Any] = {"step": step}
    if current is not None:
        payload["current"] = current
    if total is not None:
        payload["total"] = total
    if position is not None:
        payload["position"] = position
    if result is not None:
        payload["result"] = result
    if error is not None:
        payload["error"] = error

    url = str(job["progress_url"])
    headers = {"x-api-key": job["callback_key"], "Content-Type": "application/json"}

    for attempt in range(3):
        try:
            resp = http_requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code < 300:
                return
            logger.warning(
                "Progress callback attempt %d failed (status %d)", attempt + 1, resp.status_code,
            )
        except Exception as e:
            logger.warning("Progress callback attempt %d error: %s", attempt + 1, e)
        if attempt < 2:
            time.sleep(2 ** attempt)  # 1s, 2s

    logger.error("All progress callback attempts failed for job %s step %s", job["job_id"], step)


def _notify_queue_positions() -> None:
    """Send updated queue position callbacks to all queued jobs."""
    with queued_lock:
        for idx, jid in enumerate(queued_job_ids):
            j = jobs.get(jid)
            if j and j["status"] == "queued":
                _send_progress(j, "queued", position=idx)


def _process_single_job(job: dict[str, Any]) -> dict[str, Any]:
    """Process a face comparison job. Runs in executor thread (CPU-bound)."""
    # 1. Download files
    _send_progress(job, "downloading_files")

    id_bytes = _fetch_file(str(job["id_url"]))
    arr = np.frombuffer(id_bytes, dtype=np.uint8)
    id_img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if id_img is None:
        raise ValueError("Could not decode DNI image")

    video_bytes = _fetch_file(str(job["video_url"]))

    # 2. Extract frames
    _send_progress(job, "extracting_frames")
    frames = _extract_frames(video_bytes, num_frames=5)
    logger.info("Job %s: extracted %d frames", job["job_id"], len(frames))

    # 3. Compare each frame
    total_frames = len(frames)
    per_frame: list[dict[str, Any]] = []

    for i, frame in enumerate(frames):
        _send_progress(job, "comparing_frame", current=i + 1, total=total_frames)
        try:
            result = _compare_faces(id_img, frame)
            per_frame.append({
                "frame": i + 1,
                "verified": result["verified"],
                "distance": result["distance"],
                "similarity_percent": result["similarity_percent"],
            })
            logger.info(
                "Job %s frame %d: verified=%s, distance=%.4f, similarity=%.2f%%",
                job["job_id"], i + 1, result["verified"], result["distance"], result["similarity_percent"],
            )
        except Exception as e:
            logger.warning("Job %s frame %d: face detection failed (%s), skipping", job["job_id"], i + 1, e)

    if not per_frame:
        raise ValueError("No faces could be detected in any video frame")

    # 4. Aggregate
    frames_matched = sum(1 for f in per_frame if f["verified"])
    verified = frames_matched > len(per_frame) / 2

    distances = [f["distance"] for f in per_frame]
    similarities = [f["similarity_percent"] for f in per_frame]
    avg_distance = round(sum(distances) / len(distances), 6)
    avg_similarity = round(sum(similarities) / len(similarities), 2)

    return {
        "verified": verified,
        "distance": avg_distance,
        "similarity_percent": avg_similarity,
        "frames_analyzed": len(per_frame),
        "frames_matched": frames_matched,
        "per_frame": per_frame,
    }


async def _process_jobs() -> None:
    """Background worker: pull jobs from queue one at a time."""
    loop = asyncio.get_event_loop()

    while True:
        job_id = await job_queue.get()
        job = jobs.get(job_id)
        if not job:
            job_queue.task_done()
            continue

        # Remove from queued list
        with queued_lock:
            if job_id in queued_job_ids:
                queued_job_ids.remove(job_id)

        with jobs_lock:
            job["status"] = "processing"

        # Notify remaining queued jobs of updated positions
        loop.run_in_executor(None, _notify_queue_positions)

        try:
            result = await loop.run_in_executor(None, _process_single_job, job)
            with jobs_lock:
                job["status"] = "done"
                job["result"] = result
                job["finished_at"] = time.time()
            _send_progress(job, "done", result=result)
            logger.info("Job %s completed: verified=%s", job_id, result["verified"])
        except Exception as e:
            error_msg = str(e)
            with jobs_lock:
                job["status"] = "error"
                job["error"] = error_msg
                job["finished_at"] = time.time()
            _send_progress(job, "error", error=error_msg)
            logger.error("Job %s failed: %s", job_id, error_msg)
        finally:
            job_queue.task_done()


async def _cleanup_old_jobs() -> None:
    """Periodically remove finished jobs older than TTL."""
    while True:
        await asyncio.sleep(300)  # Check every 5 minutes
        now = time.time()
        with jobs_lock:
            expired = [
                jid for jid, j in jobs.items()
                if j["status"] in ("done", "error")
                and now - j.get("finished_at", now) > JOB_TTL_SECONDS
            ]
            for jid in expired:
                del jobs[jid]
        if expired:
            logger.info("Cleaned up %d expired jobs", len(expired))


@app.on_event("startup")
async def startup() -> None:
    asyncio.create_task(_process_jobs())
    asyncio.create_task(_cleanup_old_jobs())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fetch_file(url: str) -> bytes:
    """Fetch a file from the KYC service's /uploads endpoint (which decrypts and serves cleartext)."""
    if not UPLOADS_API_KEY:
        raise ValueError("UPLOADS_API_KEY not configured")

    resp = http_requests.get(
        str(url),
        headers={"x-api-key": UPLOADS_API_KEY},
        timeout=30,
    )
    if resp.status_code != 200:
        raise ValueError(f"Failed to download from URL (status {resp.status_code})")

    return resp.content


def _bytes_to_cv2(image_bytes: bytes) -> np.ndarray:
    """Decode raw image bytes into a BGR numpy array."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


def _extract_frames(video_bytes: bytes, num_frames: int = 5) -> list[np.ndarray]:
    """
    Extract keyframes from an in-memory video using PyAV.
    Keyframes (I-frames) are full-resolution and sharpest — best for face comparison.
    Falls back to evenly-spaced sampling if not enough keyframes are found.
    Returns BGR numpy arrays compatible with OpenCV/deepface.
    """
    container = av.open(io.BytesIO(video_bytes))
    stream = container.streams.video[0]

    # First pass: collect all keyframes
    keyframes: list[np.ndarray] = []
    all_frames: list[np.ndarray] = []
    total_decoded = 0

    for packet in container.demux(stream):
        for frame in packet.decode():
            total_decoded += 1
            bgr = frame.to_ndarray(format="bgr24")
            all_frames.append(bgr)
            if frame.key_frame:
                keyframes.append(bgr)

    container.close()

    if not all_frames:
        raise ValueError("Video contains no decodable frames")

    logger.info(
        "Video: %d total frames, %d keyframes", total_decoded, len(keyframes),
    )

    # Use keyframes if we have enough (skip first which may be blank)
    if len(keyframes) >= 2:
        usable = keyframes[1:] if len(keyframes) > num_frames else keyframes
        if len(usable) <= num_frames:
            return usable
        indices = np.linspace(0, len(usable) - 1, num_frames, dtype=int)
        return [usable[i] for i in indices]

    # Fallback: evenly-spaced from all frames, skip first/last 10%
    total = len(all_frames)
    start = max(0, int(total * 0.1))
    end = max(start + 1, int(total * 0.9))
    usable = all_frames[start:end]

    if len(usable) <= num_frames:
        return usable

    indices = np.linspace(0, len(usable) - 1, num_frames, dtype=int)
    return [usable[i] for i in indices]


def _compare_faces(id_img: np.ndarray, frame_img: np.ndarray) -> dict[str, Any]:
    """Run deepface verification between two BGR numpy arrays."""
    result = DeepFace.verify(
        img1_path=id_img,
        img2_path=frame_img,
        model_name="ArcFace",
        detector_backend="retinaface",
        distance_metric="cosine",
        enforce_detection=False,
    )
    distance = float(result["distance"])
    threshold = float(result["threshold"])
    verified = distance <= threshold
    similarity_percent = round((1 - distance) * 100, 2)

    return {
        "verified": verified,
        "distance": round(distance, 6),
        "similarity_percent": similarity_percent,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/compare", response_model=CompareResponse)
def compare(req: CompareRequest, _key: str = Depends(_verify_api_key)):
    """Synchronous face comparison (backward compatible)."""
    logger.info("Fetching and decrypting DNI image")
    id_bytes = _fetch_file(str(req.id_url))

    try:
        id_img = _bytes_to_cv2(id_bytes)
    except ValueError:
        raise HTTPException(status_code=400, detail="Could not decode DNI image")

    logger.info("Fetching and decrypting video")
    video_bytes = _fetch_file(str(req.video_url))

    try:
        frames = _extract_frames(video_bytes, num_frames=5)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Video processing failed: {e}")

    logger.info("Extracted %d frames from video", len(frames))

    per_frame: list[FrameResult] = []
    for i, frame in enumerate(frames):
        try:
            result = _compare_faces(id_img, frame)
            per_frame.append(
                FrameResult(
                    frame=i + 1,
                    verified=result["verified"],
                    distance=result["distance"],
                    similarity_percent=result["similarity_percent"],
                )
            )
            logger.info(
                "Frame %d: verified=%s, distance=%.4f, similarity=%.2f%%",
                i + 1, result["verified"], result["distance"], result["similarity_percent"],
            )
        except Exception as e:
            logger.warning("Frame %d: face detection failed (%s), skipping", i + 1, e)

    if not per_frame:
        raise HTTPException(
            status_code=400,
            detail="No faces could be detected in any video frame",
        )

    frames_matched = sum(1 for f in per_frame if f.verified)
    verified = frames_matched > len(per_frame) / 2

    distances = [f.distance for f in per_frame]
    similarities = [f.similarity_percent for f in per_frame]
    avg_distance = round(sum(distances) / len(distances), 6)
    avg_similarity = round(sum(similarities) / len(similarities), 2)

    return CompareResponse(
        verified=verified,
        distance=avg_distance,
        similarity_percent=avg_similarity,
        frames_analyzed=len(per_frame),
        frames_matched=frames_matched,
        per_frame=per_frame,
    )


@app.post("/compare-async", response_model=JobSubmitResponse)
async def compare_async(req: AsyncCompareRequest, _key: str = Depends(_verify_api_key)):
    """Submit a face comparison job to the queue. Returns immediately with job_id."""
    job_id = str(uuid.uuid4())

    with queued_lock:
        queue_position = len(queued_job_ids)
        queued_job_ids.append(job_id)

    with jobs_lock:
        jobs[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "id_url": str(req.id_url),
            "video_url": str(req.video_url),
            "progress_url": str(req.progress_url),
            "verification_id": req.verification_id,
            "callback_key": req.callback_key,
            "created_at": time.time(),
        }

    # Send initial queued callback before enqueuing (so it arrives before processing starts)
    job = jobs[job_id]
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_progress, job, "queued", None, None, queue_position)

    await job_queue.put(job_id)

    logger.info("Job %s queued (position %d)", job_id, queue_position)

    return JobSubmitResponse(job_id=job_id, queue_position=queue_position)


@app.get("/jobs/{job_id}")
def get_job(job_id: str, _key: str = Depends(_verify_api_key)):
    """Check job status (fallback, not normally needed)."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "error": job.get("error"),
    }


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
