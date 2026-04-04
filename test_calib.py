import sys
import os
import cv2
import numpy as np
import traceback

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from ml_engine.src.train import calibrate_model

def run_test():
    print("Generating 10 dummy images...")
    images = []
    for i in range(10):
        # 800x800 random noise images
        img = np.random.randint(0, 255, (800, 800, 3), dtype=np.uint8)
        images.append(img)
    
    print("Calling calibrate_model...")
    try:
        res = calibrate_model(images, "test_profile_123")
        print("Calibration Success:", res)
    except Exception as e:
        print("Calibration Python Exception:")
        traceback.print_exc()

if __name__ == "__main__":
    run_test()
