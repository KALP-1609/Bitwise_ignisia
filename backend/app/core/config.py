"""
Application configuration for the Veritas-Q Edge Server.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Configuration settings loaded from environment variables or .env file.
    """
    WS_PORT: int = 8000
    ACTIVE_PROFILE_DIR: str = "./profiles"
    MOTION_TOLERANCE_THRESHOLD: float = 5.0
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Global settings instance
settings = Settings()
