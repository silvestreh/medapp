import hashlib
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
from Crypto.Cipher import AES
from deepface import DeepFace
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "")

app = FastAPI(title="Face Compare Service")


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

def _derive_key(passphrase: str) -> bytes:
    """Derive a 32-byte key via SHA-256, matching the existing Node.js encryption."""
    return hashlib.sha256(passphrase.encode("utf-8")).digest()


def _decrypt(data: bytes, passphrase: str) -> bytes:
    """
    Decrypt AES-256-GCM data in the project's format:
    [16-byte IV][16-byte authTag][ciphertext]
    """
    if len(data) < 32:
        raise ValueError("Encrypted data too short")

    iv = data[:16]
    auth_tag = data[16:32]
    ciphertext = data[32:]

    key = _derive_key(passphrase)
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    return cipher.decrypt_and_verify(ciphertext, auth_tag)


def _fetch_and_decrypt(url: str) -> bytes:
    """Download encrypted data from a URL and decrypt it in memory."""
    if not ENCRYPTION_KEY:
        raise HTTPException(status_code=500, detail="ENCRYPTION_KEY not configured")

    resp = http_requests.get(str(url), timeout=30)
    if resp.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to download from URL (status {resp.status_code})",
        )

    try:
        return _decrypt(resp.content, ENCRYPTION_KEY)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Decryption failed: {e}")


def _bytes_to_cv2(image_bytes: bytes) -> np.ndarray:
    """Decode raw image bytes into a BGR numpy array."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


def _extract_frames(video_bytes: bytes, num_frames: int = 5) -> list[np.ndarray]:
    """
    Extract evenly-spaced frames from an in-memory video using PyAV.
    Skips the first/last 10% of the video to avoid blank frames.
    Returns BGR numpy arrays compatible with OpenCV/deepface.
    """
    container = av.open(io.BytesIO(video_bytes))
    stream = container.streams.video[0]

    total_frames = stream.frames
    if total_frames == 0:
        # If frame count is unknown, decode all and sample afterwards
        all_frames: list[np.ndarray] = []
        for frame in container.decode(video=0):
            rgb = frame.to_ndarray(format="bgr24")
            all_frames.append(rgb)
        container.close()

        if not all_frames:
            raise ValueError("Video contains no decodable frames")

        total = len(all_frames)
        start = max(0, int(total * 0.1))
        end = max(start + 1, int(total * 0.9))
        usable = all_frames[start:end]

        if len(usable) <= num_frames:
            return usable

        indices = np.linspace(0, len(usable) - 1, num_frames, dtype=int)
        return [usable[i] for i in indices]

    # Known frame count: seek to specific positions
    start = max(0, int(total_frames * 0.1))
    end = max(start + 1, int(total_frames * 0.9))
    usable_count = end - start

    if usable_count <= num_frames:
        target_indices = set(range(start, end))
    else:
        target_indices = set(
            int(i) for i in np.linspace(start, end - 1, num_frames, dtype=int)
        )

    frames: list[np.ndarray] = []
    for i, frame in enumerate(container.decode(video=0)):
        if i >= end:
            break
        if i in target_indices:
            bgr = frame.to_ndarray(format="bgr24")
            frames.append(bgr)

    container.close()

    if not frames:
        raise ValueError("Could not extract any frames from video")

    return frames


def _compare_faces(id_img: np.ndarray, frame_img: np.ndarray) -> dict[str, Any]:
    """Run deepface verification between two BGR numpy arrays."""
    result = DeepFace.verify(
        img1_path=id_img,
        img2_path=frame_img,
        model_name="ArcFace",
        detector_backend="opencv",
        distance_metric="cosine",
        enforce_detection=True,
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
def compare(req: CompareRequest):
    # 1. Fetch and decrypt DNI image
    logger.info("Fetching and decrypting DNI image")
    id_bytes = _fetch_and_decrypt(str(req.id_url))

    try:
        id_img = _bytes_to_cv2(id_bytes)
    except ValueError:
        raise HTTPException(status_code=400, detail="Could not decode DNI image")

    # 2. Fetch, decrypt, and extract frames from video
    logger.info("Fetching and decrypting video")
    video_bytes = _fetch_and_decrypt(str(req.video_url))

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
