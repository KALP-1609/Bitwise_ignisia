"""
Module to bridge the backend to the external ML inference engine.
"""

import sys
import os
import asyncio
import numpy as np
from typing import List, Tuple

# --- 🛠️ THE PATH HACK ---
# Point sys.path directly into the ml_engine folder so Python can find 'src'
ML_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ml_engine"))
if ML_DIR not in sys.path:
    sys.path.append(ML_DIR)

from src.train import calibrate_model as ml_calibrate, adapt_memory_bank as ml_adapt
from src.predict import run_inference as ml_predict, register_accepted_variation

async def calibrate_model(images_cv2: List[np.ndarray], profile_name: str) -> bool:
    """
    Trains the .pkl memory bank using perfect reference images on a background thread.
    
    Args:
        images_cv2 (List[np.ndarray]): A list of reference images.
        profile_name (str): The name of the profile to calibrate.
        
    Returns:
        bool: True if calibration succeeded, False otherwise.
    """
    print(f"🧠 [ML Bridge] Dispatching calibration for '{profile_name}' to PyTorch...")
    
    # ⚡ Run the heavy PyTorch training on a background thread so the WebSocket doesn't freeze
    success = await asyncio.to_thread(ml_calibrate, images_cv2, profile_name)
    return success

async def run_inference(frame_cv2: np.ndarray, profile_name: str, threshold: float = 0.95) -> Tuple[bool, float, np.ndarray, bool]:
    """
    Runs the live frame against the PatchCore model on a background thread.
    
    Args:
        frame_cv2 (np.ndarray): The camera frame to inspect.
        profile_name (str): The associated profile for inspection scoring.
        threshold (float): The dynamically specified defect threshold.
        
    Returns:
        Tuple[bool, float, np.ndarray, bool]:
            - bool: Detection result (True if defective, False if pass).
            - float: Confidence score (0.0 to 1.0).
            - np.ndarray: The colorized heatmap overlay image.
            - bool: product_drift boolean.
    """
    # ⚡ Run the heavy PyTorch prediction on a background thread
    is_defective, confidence, heatmap_cv2, drift = await asyncio.to_thread(ml_predict, frame_cv2, profile_name, threshold)
    
    # Cast to pure Python types so Pydantic serialization doesn't silently fail
    return bool(is_defective), float(confidence), heatmap_cv2, bool(drift)

async def adapt_model(image_cv2: np.ndarray, profile_name: str) -> bool:
    """
    Adapts the specified profile's memory bank using the new normal image.
    Run on a background thread so the HTTP Request returns immediately.
    """
    print(f"🧠 [ML Bridge] Dispatching adaptation for '{profile_name}' to PyTorch...")
    
    # Software override: Instant memory validation mapping
    register_accepted_variation(image_cv2, profile_name)
    
    success = await asyncio.to_thread(ml_adapt, image_cv2, profile_name)
    return success