"""
WebSocket endpoints for real-time video streaming and inspection.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.schemas.responses import WSDefectResponse
from app.utils.image_parser import base64_to_cv2, cv2_to_base64
from app.services.session_mgr import session_mgr
from app.services.auto_trigger import MotionDetector
from app.ml_bridge.inference import run_inference
import json

router = APIRouter()
motion_detector = MotionDetector()

@router.websocket("/stream")
async def process_stream(websocket: WebSocket):
    """
    Continuous WebSocket connection handling the video stream and trigger logic.
    """
    await websocket.accept()
    
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
                profile = session_mgr.active_profile
                is_defective, heatmap_cv2 = await run_inference(frame_cv2, profile)
                
                # Check whether this counts as an official scan
                is_official_scan = False
                if is_stationary and session_mgr.can_scan():
                    is_official_scan = True
                    session_mgr.update_stats(is_defective)
                    
                # Convert heatmap back to base64
                heatmap_base64 = cv2_to_base64(heatmap_cv2)
                
                # Send response
                response = WSDefectResponse(
                    status="completed",
                    is_defective=is_defective,
                    heatmap_base64=heatmap_base64,
                    is_official_scan=is_official_scan
                )
                await websocket.send_text(response.model_dump_json())
                
            except Exception as frame_error:
                # Broad exception block to prevent WebSocket crash on bad frames
                error_response = WSDefectResponse(
                    status="error",
                    is_defective=False,
                    heatmap_base64="",
                    is_official_scan=False
                )
                await websocket.send_text(error_response.model_dump_json())
                print(f"WS frame processing error: {frame_error}")
                
    except WebSocketDisconnect:
        print("WebSocket client disconnected.")
    except Exception as e:
        print(f"WebSocket connection error: {e}")
