import os
import cv2
import shutil
import numpy as np
from anomalib.engine import Engine
from anomalib.models import Patchcore
from anomalib.data import Folder

# fallback for older anomalib export enums
try:
    from anomalib.deploy import ExportType
    EXPORT_MODE = ExportType.TORCH
except ImportError:
    EXPORT_MODE = "torch"

try:
    from src.predict import flush_inferencer
except ImportError:
    flush_inferencer = lambda x: None

def calibrate_model(image_list: list[np.ndarray], profile_name: str) -> bool:
    print(f"[ML] Starting calibration for profile: {profile_name}")
    # Clear RAM cache so it loads the new weights
    flush_inferencer(profile_name)

    # prep temp folder structure for anomalib's dataloader
    base_dir = os.path.abspath(f"./data/temp_{profile_name}")
    normal_dir = os.path.join(base_dir, "normal")
    abnormal_dir = os.path.join(base_dir, "abnormal")

    if os.path.exists(base_dir): shutil.rmtree(base_dir)
    os.makedirs(normal_dir, exist_ok=True)
    os.makedirs(abnormal_dir, exist_ok=True)

    try:
        # dump clean images to disk and automatically augment them to build robust tolerance
        # (If a user uploads perfect static images off google, the variance is 0 and any test normalizes to a 1.0 defect. Augmentation fixes this)
        count = 0
        for idx, img in enumerate(image_list):
            # 1. Base Image
            cv2.imwrite(os.path.join(normal_dir, f"sample_{count}.jpg"), img)
            count += 1
            
            # 2. Bright Variance
            bright = cv2.convertScaleAbs(img, alpha=1.1, beta=15)
            cv2.imwrite(os.path.join(normal_dir, f"sample_{count}.jpg"), bright)
            count += 1
            
            # 3. Dark Variance
            dark = cv2.convertScaleAbs(img, alpha=0.9, beta=-15)
            cv2.imwrite(os.path.join(normal_dir, f"sample_{count}.jpg"), dark)
            count += 1
            
            # 4. Translation Variance (To simulate jitter/handling)
            M = np.float32([[1, 0, 8], [0, 1, 8]])
            shifted = cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), borderMode=cv2.BORDER_REPLICATE)
            cv2.imwrite(os.path.join(normal_dir, f"sample_{count}.jpg"), shifted)
            count += 1

        # Create a severely "defective" dummy image so Anomalib's MinMax normalization learns a wide scaling bound.
        # (If the dummy is identical to normal images, max distance bound evaluates to 0.0, and any FP16 OpenVINO jitter normalizes to 1.0)
        dummy_def = image_list[0].copy()
        h, w = dummy_def.shape[:2]
        cv2.rectangle(dummy_def, (w//4, h//4), (w - w//4, h - h//4), (0, 0, 0), -1)
        
        # add 4 dummy defect images to bypass lightning's validation split rules
        for i in range(4):
            cv2.imwrite(os.path.join(abnormal_dir, f"dummy_defect_{i}.jpg"), dummy_def)
    except Exception as e:
        print(f"[ML] ERROR: Failed to write calibration images: {e}")
        return False

    try:
        datamodule = Folder(
            name=profile_name,
            root=base_dir,
            normal_dir="normal",
            abnormal_dir="abnormal",
            train_batch_size=2,
            eval_batch_size=2
        )
    except Exception as e:
        print(f"[ML] ERROR: Failed to init DataModule: {e}")
        return False

    # lightweight backbone for fast edge inference
    model = Patchcore(backbone="wide_resnet50_2", pre_trained=True, coreset_sampling_ratio=0.1)

    # aggressive flags to kill progress bars, loggers, and validation checks
    engine = Engine(
        max_epochs=1,
        default_root_dir=os.path.abspath(f"../backend/app/ml_bridge/memory_banks/{profile_name}"),
        limit_val_batches=0,
        limit_test_batches=0,
        num_sanity_val_steps=0,
        log_every_n_steps=1,
        enable_progress_bar=False,
        logger=False
    )

    try:
        engine.fit(model=model, datamodule=datamodule)
        print(f"[ML] Memory Bank trained for {profile_name}")

        # compile to torchscript for faster runtime
        print("[ML] Exporting model to TorchScript...")
        try:
            engine.export(model=model, export_type=EXPORT_MODE, datamodule=datamodule)
        except Exception:
            engine.export(model=model, export_type=EXPORT_MODE)

        print("[ML] Export complete.")
        return True
    except Exception as e:
        import traceback
        print("[ML] ERROR: Calibration failed with traceback:")
        traceback.print_exc()
        return False

def adapt_memory_bank(new_image: np.ndarray, profile_name: str) -> bool:
    """
    Twist 1: Incrementally adapts the memory bank without dropping UI.
    """
    import glob
    base_dir = os.path.abspath(f"./data/temp_{profile_name}/normal")
    if not os.path.exists(base_dir):
        return False
        
    try:
        # Write new frame immediately to standard bounds
        file_count = len(glob.glob(os.path.join(base_dir, "*.jpg")))
        cv2.imwrite(os.path.join(base_dir, f"adapt_learned_{file_count}.jpg"), new_image)
        
        # Load all images (original + adapted) and recalibrate structurally
        all_imgs = []
        for file_path in glob.glob(os.path.join(base_dir, "*.jpg")):
            loaded = cv2.imread(file_path)
            if loaded is not None:
                all_imgs.append(loaded)
                
        # Re-train
        return calibrate_model(all_imgs, profile_name)
    except Exception as e:
        print(f"[ML-ADAPT] ERROR: Could not adapt model: {e}")
        return False