"""
Response schemas for the Veritas-Q Edge Server.
"""

from pydantic import BaseModel, Field
from typing import Optional

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
    total_scanned: int = Field(..., description="Total number of items scanned in the current session")
    passed: int = Field(..., description="Number of items that passed inspection")
    failed: int = Field(..., description="Number of items that failed inspection")
    defect_rate: float = Field(..., description="Percentage of failed items")
    active_profile: str = Field("", description="The name of the currently active inspection profile")

class WSDefectResponse(BaseModel):
    """
    WebSocket response schema for defect detection results.
    """
    status: str = Field(..., description="Status of the defect detection, e.g., 'completed' or 'error'")
    is_defective: bool = Field(..., description="True if a defect was detected, False otherwise")
    confidence: float = Field(..., description="Confidence score of the prediction (0.0 to 1.0)")
    heatmap_base64: Optional[str] = Field(None, description="Base64 encoded string of the heatmap overlay image of the original boundaries")
    is_official_scan: bool = Field(False, description="Whether this scan should increment the analytics counters")
    product_drift: bool = Field(False, description="True if the anomaly score vastly exceeds standard defect boundaries, indicating a product swap")