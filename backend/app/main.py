"""
Main FastAPI application setup and routing.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import profiles, stats, websockets, inspect

app = FastAPI(
    title="Veritas-Q Edge Server",
    description="FastAPI Backend for Visual Quality Inspection",
    version="1.0.0"
)

# 1. Define who is allowed to talk to the API
origins = [
    "http://localhost:3000",
    "http://localhost:5173", # Vite's default port
    "http://127.0.0.1:5173",
]

# 2. Add the CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(profiles.router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])
app.include_router(websockets.router, prefix="/ws", tags=["WebSocket"])
app.include_router(inspect.router, prefix="/api/inspect", tags=["Inspect"])

@app.get("/", tags=["Health"])
async def root():
    """Simple health-check endpoint."""
    return {"status": "ok", "message": "Veritas-Q Edge Server is running"}