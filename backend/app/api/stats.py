"""
API endpoints for retrieving inspection statistics.
"""

from fastapi import APIRouter
from app.schemas.responses import StatsResponse
from app.services.session_mgr import session_mgr

router = APIRouter()

@router.get("/", response_model=StatsResponse)
async def get_stats():
    """
    Retrieve the current session statistics.
    """
    stats = session_mgr.get_stats()
    return StatsResponse(
        total_scanned=stats["total_scanned"],
        passed=stats["passed"],
        failed=stats["failed"],
        defect_rate=stats["defect_rate"],
        active_profile=stats["active_profile"]
    )
