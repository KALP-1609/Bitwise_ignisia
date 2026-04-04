"""
API endpoints for managing inspection profiles.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.schemas.requests import ProfileCreate, InspectionRequest
from app.schemas.responses import ProfileResponse
from app.utils.image_parser import base64_to_cv2
from app.ml_bridge.inference import calibrate_model, adapt_model
from app.services.session_mgr import session_mgr

router = APIRouter()

@router.post("/", response_model=ProfileResponse)
async def create_profile(profile_data: ProfileCreate):
    """
    Create and calibrate a new inspection profile.
    """
    try:
        # Convert base64 images to cv2 formats
        images_cv2 = [base64_to_cv2(img) for img in profile_data.images_base64]
        
        # Calibrate the ML model
        success = await calibrate_model(images_cv2, profile_data.name)
        if not success:
            raise HTTPException(status_code=500, detail="Model calibration failed.")
            
        # Update active session with the new profile
        session_mgr.set_active_profile(profile_data.name)
        
        return ProfileResponse(status="success", profile_name=profile_data.name)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/active", response_model=ProfileResponse)
async def get_active_profile():
    """
    Get the currently active inspection profile.
    """
    active_profile = session_mgr.active_profile
    if not active_profile:
        raise HTTPException(status_code=404, detail="No active profile found")
        
    return ProfileResponse(status="success", profile_name=active_profile)

@router.post("/adapt")
async def adapt_active_profile(payload: InspectionRequest, background_tasks: BackgroundTasks):
    """
    Twist 1: Adapt the currently active model's memory bank with a new 'Normal' image dynamically.
    Execute structurally as an un-awaited task so it doesn't drop the production line.
    """
    active_profile = session_mgr.active_profile
    if not active_profile:
        raise HTTPException(status_code=400, detail="Cannot adapt: No active profile is loaded.")
        
    try:
        image_cv2 = base64_to_cv2(payload.image_base64)
        background_tasks.add_task(adapt_model, image_cv2, active_profile)
        return {"status": "success", "message": "Adaptation queued successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
