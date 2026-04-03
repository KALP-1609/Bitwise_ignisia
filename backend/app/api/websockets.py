"""
WebSocket endpoints for real-time video streaming and inspection.
"""

import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.schemas.responses import WSDefectResponse
from app.utils.image_parser import base64_to_cv2, cv2_to_base64
from app.services.session_mgr import session_mgr
from app.services.auto_trigger import MotionDetector
from app.ml_bridge.inference import run_inference

router = APIRouter()
motion_detector = MotionDetector()

# Grab the default uvicorn logger for clean terminal output
logger = logging.getLogger("uvicorn.error")

@router.websocket("/stream")
async def process_stream(websocket: WebSocket):
    """
    Continuous WebSocket connection handling the video stream and trigger logic.
    """
    await websocket.accept()
    logger.info("🟢 [WS] Client connected to live stream.")
    
    try:
        while True:
            # Receive base64 frame from client
            base64_frame = await websocket.receive_text()
            
            try:
                # Parse image
                frame_cv2 = base64_to_cv2(base64_frame)
                
                # Check for motion/stationary state
                is_stationary = motion_detector.is_stationary(frame_cv2)
                
                # Always run inference for UI display purposes
                profile = session_mgr.active_profile or "default_profile"
                
                # 🧠 UPDATE: Catch all 3 variables including confidence
                is_defective, confidence, heatmap_cv2 = await run_inference(frame_cv2, profile)
                
                # Check whether this counts as an official scan
                is_official_scan = False
                if is_stationary:
                    is_official_scan = True
                    session_mgr.update_stats(is_defective)
                    logger.info(f"📊 [AUTO-TRIGGER] Scanned. Defective: {is_defective} | Conf: {confidence:.2f}")
                    
                # Convert heatmap back to base64
                heatmap_base64 = cv2_to_base64(heatmap_cv2)
                
                # Send response (Added confidence here)
                response = WSDefectResponse(
                    status="completed",
                    is_defective=is_defective,
                    confidence=confidence,
                    heatmap_base64=heatmap_base64,
                    is_official_scan=is_official_scan
                )
                await websocket.send_text(response.model_dump_json())
                
            except Exception as frame_error:
                # Broad exception block to prevent WebSocket crash on bad frames
                error_response = WSDefectResponse(
                    status="error",
                    is_defective=False,
                    confidence=0.0,  # <-- Added fallback confidence to prevent Pydantic validation crashes
                    heatmap_base64="",
                    is_official_scan=False
                )
                await websocket.send_text(error_response.model_dump_json())
                logger.error(f"🔴 [WS] Frame processing error: {frame_error}")
                
    except WebSocketDisconnect:
        logger.info("🔴 [WS] WebSocket client disconnected.")
    except Exception as e:
        logger.error(f"🔴 [WS] WebSocket connection error: {e}")