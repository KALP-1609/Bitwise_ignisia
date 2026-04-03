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
