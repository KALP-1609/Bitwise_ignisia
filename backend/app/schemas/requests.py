"""
Request schemas for the Veritas-Q Edge Server.
"""

from typing import List
from pydantic import BaseModel, Field

class ProfileCreate(BaseModel):
    """
    Schema for creating a new scanning profile with reference images.
    """
    name: str = Field(..., description="The name of the profile")
    images_base64: List[str] = Field(
        ..., 
        description="A list of reference images encoded as base64 strings"
    )

class InspectionRequest(BaseModel):
    """
    Schema for manually submitting a single image for testing against the currently active profile.
    """
    image_base64: str = Field(..., description="The testing image encoded as a base64 string")
    threshold: float = Field(0.95, description="The custom user threshold for flagging defects")
