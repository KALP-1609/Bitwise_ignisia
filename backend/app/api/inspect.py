"""
Manual Inspection API endpoint.
"""
from fastapi import APIRouter, HTTPException, status
import logging

from app.schemas.requests import InspectionRequest
from app.schemas.responses import WSDefectResponse
from app.utils.image_parser import base64_to_cv2, cv2_to_base64
from app.ml_bridge.inference import run_inference
from app.services.session_mgr import session_mgr

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=WSDefectResponse, status_code=status.HTTP_200_OK)
async def inspect_image(request: InspectionRequest):
    """
    Manually evaluate a single image against the active profile.
    """
    if not session_mgr.active_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active profile selected. Please calibrate a profile first."
        )

    try:
        # 1. Parse Image
        frame_cv2 = base64_to_cv2(request.image_base64)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse base64 image: {str(e)}"
        )

    try:
        # 2. Run Inference
        is_defective, confidence, heatmap_cv2 = await run_inference(frame_cv2, session_mgr.active_profile)
        
        # 3. Update Stats
        # Since this is a manual test, we always count it as an official scan
        session_mgr.update_stats(is_defective)

        heatmap_base64 = None
        if heatmap_cv2 is not None:
            heatmap_base64 = cv2_to_base64(heatmap_cv2)

        # 4. Return Output
        return WSDefectResponse(
            status="completed",
            is_defective=is_defective,
            confidence=confidence,
            heatmap_base64=heatmap_base64,
            is_official_scan=True
        )

    except Exception as e:
        logger.error(f"Inference error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference failed: {str(e)}"
        )
