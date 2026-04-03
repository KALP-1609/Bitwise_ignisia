"""
Automatic triggering logic based on visual motion detection.
"""

import cv2
import numpy as np
from app.core.config import settings

class MotionDetector:
    """
    Detects when an object has stopped moving within the field of view.
    """
    
    def __init__(self):
        self.previous_frame: np.ndarray = None
        self.state = "STATIONARY"  # Valid states: "MOVING", "STATIONARY"
        
    def is_stationary(self, current_frame: np.ndarray) -> bool:
        """
        Determine if the scene is stationary using an Edge-Triggered Machine.
        
        It ensures a scan is ONLY triggered once per action:
        (1) Detect 'MOVING' when motion spikes past moving_thresh.
        (2) Detect 'STATIONARY' when motion settles below stationary_thresh.
        
        Args:
            current_frame (np.ndarray): The latest OpenCV BGR frame.
            
        Returns:
            bool: True only ONCE when an object finishes moving and settles.
        """
        if current_frame is None or current_frame.size == 0:
            return False
            
        # Convert the current frame to grayscale
        gray_frame = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)
        
        # Apply heavy blur to completely eliminate innate webcam sensor noise
        gray_frame = cv2.GaussianBlur(gray_frame, (21, 21), 0)
        
        # Reset baseline if it's the first frame OR if the camera resolution changed
        if self.previous_frame is None or self.previous_frame.shape != gray_frame.shape:
            self.previous_frame = gray_frame
            return False
            
        # Calculate the absolute difference between the current frame and previous frame
        frame_diff = cv2.absdiff(self.previous_frame, gray_frame)
        
        # Calculate the mean intensity difference across the frame
        mean_diff = np.mean(frame_diff)
        
        # Update the previous frame for the next check
        self.previous_frame = gray_frame
        
        # Define the thresholds
        stationary_thresh = settings.MOTION_TOLERANCE_THRESHOLD        # Default 5.0
        moving_thresh = settings.MOTION_TOLERANCE_THRESHOLD * 2.0      # Default 10.0
        
        if mean_diff > moving_thresh:
            self.state = "MOVING"
            return False
            
        elif mean_diff <= stationary_thresh and self.state == "MOVING":
            # The part was moving, and has now come to a complete stop!
            # Trigger our edge detection scan and reset state.
            self.state = "STATIONARY"
            return True
            
        return False
