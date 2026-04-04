import os
import warnings
import cv2
import numpy as np
from anomalib.deploy import OpenVINOInferencer, TorchInferencer

# allow local model loading and mute the legacy warnings
os.environ["TRUST_REMOTE_CODE"] = "1"
warnings.filterwarnings("ignore")

# cache models in RAM so we don't fry the CPU reloading them every frame
ACTIVE_INFERENCERS = {}

ACCEPTED_VARIATIONS = {}

def register_accepted_variation(cv2_image: np.ndarray, profile_name: str):
    global ACCEPTED_VARIATIONS
    if profile_name not in ACCEPTED_VARIATIONS:
        ACCEPTED_VARIATIONS[profile_name] = []
    
    # Store resized to standard boundary to save RAM and ensure fast checks
    resized = cv2.resize(cv2_image, (256, 256))
    ACCEPTED_VARIATIONS[profile_name].append(cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY))

def find_latest_model_file(base_dir: str, filename_or_ext: str) -> str:
    # anomalib creates new versions (version_0, version_1). We must find the latest one.
    if not os.path.exists(base_dir): return None
    candidates = []
    for root, _, files in os.walk(base_dir):
        for file in files:
            if file.endswith(filename_or_ext): 
                full_path = os.path.join(root, file)
                candidates.append((full_path, os.path.getmtime(full_path)))
    
    if not candidates:
        return None
        
    # Sort by modification time descending, return the newest one
    candidates.sort(key=lambda x: x[1], reverse=True)
    return candidates[0][0]

def flush_inferencer(profile_name: str):
    if profile_name in ACTIVE_INFERENCERS:
        del ACTIVE_INFERENCERS[profile_name]

def load_inferencer(profile_name: str):
    if profile_name not in ACTIVE_INFERENCERS:
        base_dir = os.path.abspath(f"../backend/app/ml_bridge/memory_banks/{profile_name}")
        openvino_path = find_latest_model_file(base_dir, "model.xml")
        torch_path = find_latest_model_file(base_dir, "model.pt")

        try:
            # prefer openvino for speed, fallback to torchscript
            if openvino_path:
                ACTIVE_INFERENCERS[profile_name] = OpenVINOInferencer(path=openvino_path, device="CPU")
            elif torch_path:
                ACTIVE_INFERENCERS[profile_name] = TorchInferencer(path=torch_path, device="cpu")
            else:
                print(f"[ML] ERROR: Missing model files in {base_dir}")
                return None
        except Exception as e:
            print(f"[ML] ERROR: Inferencer crash: {e}")
            return None

    return ACTIVE_INFERENCERS[profile_name]

def run_inference(cv2_frame: np.ndarray, profile_name: str, dynamic_threshold: float = 0.95) -> tuple[bool, float, np.ndarray, bool]:
    inferencer = load_inferencer(profile_name)
    if inferencer is None: return False, 0.0, cv2_frame, False

    try:
        # OpenCV natively uses BGR. Anomalib's PyTorch Dataloader trains on RGB.
        # We MUST swap channels before prediction, otherwise perfect images evaluate as massive anomalies due to inverted colors.
        rgb_frame = cv2.cvtColor(cv2_frame, cv2.COLOR_BGR2RGB)
        
        predictions = inferencer.predict(image=rgb_frame)
        raw_score = float(predictions.pred_score)

        # Print the raw score so the user can see the exact numerical distance of the evaluation
        print(f"[ML-EVAL] Raw Anomaly Score for {profile_name}: {raw_score}")

        # Software Override checks
        accepted_variations = ACCEPTED_VARIATIONS.get(profile_name, [])
        if accepted_variations:
            frame_gray = cv2.cvtColor(cv2.resize(cv2_frame, (256, 256)), cv2.COLOR_BGR2GRAY)
            for var_gray in accepted_variations:
                # Fast MSE compute
                err = np.sum((frame_gray.astype("float") - var_gray.astype("float")) ** 2)
                err /= float(frame_gray.shape[0] * frame_gray.shape[1])
                if err < 50.0:  # Same image mathematically
                    print(f"[ML-OVERRIDE] Matched accepted variation (MSE: {err}). Hard-lowering raw score.")
                    raw_score = dynamic_threshold * 0.5  # Force pass dynamically below threshold
                    break

        # Setting dynamic threshold based on user slider
        is_defective = raw_score > dynamic_threshold
        
        # Product Drift Detection (Twist 2)
        # We determine a complete environmental/structural shift by making the drift boundary extremely strict.
        # It must be vastly larger than the normal threshold (4x) OR exceed a hard ceiling of 100.
        product_drift = raw_score > max(dynamic_threshold * 4.0, 100.0)

        # We will pass the RAW score directly out as confidence so the frontend can visibly see it for threshold calibration
        confidence = raw_score

        heatmap_overlay = predictions.anomaly_map
        
        # force numpy array and squeeze out batch/channel dims if they exist (e.g., 1xHxW to HxW)
        if isinstance(heatmap_overlay, np.ndarray):
            heatmap_overlay = np.squeeze(heatmap_overlay)

        # colorize the heatmap mask and blend it with the original frame
        if len(heatmap_overlay.shape) == 2:
            # Mask is float32 0-1, so normalize to 0-255 uint8
            heatmap_overlay = cv2.applyColorMap((heatmap_overlay * 255).astype(np.uint8), cv2.COLORMAP_JET)
            
            # Ensure cv2_frame shape matches heatmap_overlay (PatchCore interpolates output, might not match original input)
            if heatmap_overlay.shape[:2] != cv2_frame.shape[:2]:
                heatmap_overlay = cv2.resize(heatmap_overlay, (cv2_frame.shape[1], cv2_frame.shape[0]))
                
            heatmap_overlay = cv2.addWeighted(cv2_frame, 0.5, heatmap_overlay, 0.5, 0)
        else:
             # Just in case it's completely malformed, fall back to returning cv2_frame safely
             heatmap_overlay = cv2_frame

        return is_defective, float(confidence), heatmap_overlay, product_drift

    except Exception as e:
        print(f"[ML] WARNING: Frame dropped: {e}")
        return False, 0.0, cv2_frame, False