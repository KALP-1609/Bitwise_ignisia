"""
Main FastAPI application setup and routing.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import profiles, stats, websockets

app = FastAPI(
    title="Veritas-Q Edge Server",
    description="FastAPI Backend for Visual Quality Inspection",
    version="1.0.0"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(profiles.router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])
app.include_router(websockets.router, prefix="/ws", tags=["WebSocket"])

@app.get("/", tags=["Health"])
async def root():
    """Simple health-check endpoint."""
    return {"status": "ok", "message": "Veritas-Q Edge Server is running"}
