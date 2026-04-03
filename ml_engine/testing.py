import cv2
import numpy as np
import os
from src.train import calibrate_model
from src.predict import run_inference

def main():
    print("[TEST] Generating dummy factory data...")

    # generate 10 blank gray images for a clean baseline
    dummy_clean_image = np.full((256, 256, 3), 128, dtype=np.uint8)
    clean_list = [dummy_clean_image for _ in range(10)]

    # inject a white square to simulate a physical defect
    dummy_defective_image = dummy_clean_image.copy()
    cv2.rectangle(dummy_defective_image, (100, 100), (150, 150), (255, 255, 255), -1)

    profile = "alpha_test_v1"

    print("\n--- TEST 1: CALIBRATION ---")
    success = calibrate_model(clean_list, profile)

    if not success:
        print("[TEST] ERROR: Calibration Failed. Check anomalib installation.")
        return

    print("\n--- TEST 2: INFERENCE ---")

    # run inference on baseline
    is_def, conf, _ = run_inference(dummy_clean_image, profile)
    print(f"[TEST] Clean Image -> Defective: {is_def} | Confidence: {conf:.2f}")

    # run inference on defect
    is_def_bad, conf_bad, _ = run_inference(dummy_defective_image, profile)
    print(f"[TEST] Defect Image -> Defective: {is_def_bad} | Confidence: {conf_bad:.2f}")

    # validate threshold logic
    if is_def_bad and not is_def:
        print("\n[TEST] SUCCESS: Engine is bulletproof. Ready for backend integration.")
    else:
        print("\n[TEST] WARNING: Math looks weird. Check PatchCore config thresholds.")

if __name__ == "__main__":
    main()