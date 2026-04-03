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

# --- 🧠 IMPORT THE ACTUAL ML FUNCTIONS ---
from src.train import calibrate_model as ml_calibrate
from src.predict import run_inference as ml_predict

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

async def run_inference(frame_cv2: np.ndarray, profile_name: str) -> Tuple[bool, float, np.ndarray]:
    """
    Runs the live frame against the PatchCore model on a background thread.
    
    Args:
        frame_cv2 (np.ndarray): The camera frame to inspect.
        profile_name (str): The associated profile for inspection scoring.
        
    Returns:
        Tuple[bool, float, np.ndarray]:
            - bool: Detection result (True if defective, False if pass).
            - float: Confidence score (0.0 to 1.0).
            - np.ndarray: The colorized heatmap overlay image.
    """
    # ⚡ Run the heavy PyTorch prediction on a background thread
    is_defective, confidence, heatmap_cv2 = await asyncio.to_thread(ml_predict, frame_cv2, profile_name)
    
    return is_defective, confidence, heatmap_cv2