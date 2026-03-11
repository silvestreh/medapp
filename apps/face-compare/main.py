import io
import logging
import os
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fetch_file(url: str) -> bytes:
    """Fetch a file from the KYC service's /uploads endpoint (which decrypts and serves cleartext)."""
    if not UPLOADS_API_KEY:
        raise HTTPException(status_code=500, detail="UPLOADS_API_KEY not configured")

    resp = http_requests.get(
        str(url),
        headers={"x-api-key": UPLOADS_API_KEY},
        timeout=30,
    )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to download from URL (status {resp.status_code})",
        )

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
# Endpoint
# ---------------------------------------------------------------------------

@app.post("/compare", response_model=CompareResponse)
def compare(req: CompareRequest, _key: str = Depends(_verify_api_key)):
    # 1. Fetch and decrypt DNI image
    logger.info("Fetching and decrypting DNI image")
    id_bytes = _fetch_file(str(req.id_url))

    try:
        id_img = _bytes_to_cv2(id_bytes)
    except ValueError:
        raise HTTPException(status_code=400, detail="Could not decode DNI image")

    # 2. Fetch, decrypt, and extract frames from video
    logger.info("Fetching and decrypting video")
    video_bytes = _fetch_file(str(req.video_url))

    try:
        frames = _extract_frames(video_bytes, num_frames=5)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Video processing failed: {e}")

    logger.info("Extracted %d frames from video", len(frames))

    # 3. Compare each frame against the DNI image
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

    # 4. Aggregate: majority vote
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


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
