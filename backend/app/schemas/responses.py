"""
Response schemas for the Veritas-Q Edge Server.
"""

from pydantic import BaseModel, Field

class ProfileResponse(BaseModel):
    """
    Response schema for profile operations.
    """
    status: str = Field(..., description="Status of the operation, e.g., 'success' or 'error'")
    profile_name: str = Field(..., description="The name of the profile")

class StatsResponse(BaseModel):
    """
    Response schema for system statistics.
    """
    total_scanned: int = Field(..., description="Total number of items scanned")
    passed: int = Field(..., description="Number of items that passed inspection")
    failed: int = Field(..., description="Number of items that failed inspection")
    defect_rate: float = Field(..., description="Percentage of items that failed inspection")

class WSDefectResponse(BaseModel):
    """
    WebSocket response schema for defect detection results.
    """
    status: str = Field(..., description="Status of the defect detection, e.g., 'completed' or 'error'")
    is_defective: bool = Field(..., description="True if a defect was detected, False otherwise")
    heatmap_base64: str = Field(..., description="Base64 encoded string of the resulting defect heatmap image")
    is_official_scan: bool = Field(..., description="Indicates whether this scan is part of the official record")
