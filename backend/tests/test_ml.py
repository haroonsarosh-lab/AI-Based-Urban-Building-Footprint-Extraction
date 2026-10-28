"""
UrbanFootprint AI - Machine Learning Unit Tests
Tests U-Net architecture, metric computation, dataset splitting without leakage,
and inference engine states.
"""

import torch
import numpy as np
import pytest

from ml.model import BuildingUNet
from ml.evaluate import compute_binary_metrics
from ml.dataset import split_scenes_without_leakage, generate_synthetic_aerial_patch
from ml.inference import InferenceEngine


def test_building_unet_forward():
    """Verify BuildingUNet dimensions and output shapes"""
    model = BuildingUNet(n_channels=3, n_classes=1, base_features=16)
    model.eval()
    # Batch size 2, 3 channels, 128x128
    dummy_input = torch.randn(2, 3, 128, 128)
    with torch.no_grad():
        output = model(dummy_input)

    assert output.shape == (2, 1, 128, 128)
    assert not torch.isnan(output).any()


def test_segmentation_metrics():
    """Verify precision, recall, IoU, and Dice computations"""
    # Perfect match
    y_true = np.ones((50, 50), dtype=np.uint8)
    y_pred = np.ones((50, 50), dtype=np.float32)
    m = compute_binary_metrics(y_pred, y_true, threshold=0.5)
    assert m["iou"] == 1.0
    assert m["dice"] == 1.0
    assert m["precision"] == 1.0
    assert m["recall"] == 1.0

    # Half overlap: 50 TP, 50 FP, 0 FN -> Precision 0.5, Recall 1.0, IoU 0.5
    y_pred = np.zeros((100,), dtype=np.float32)
    y_pred[:100] = 1.0
    y_true = np.zeros((100,), dtype=np.uint8)
    y_true[:50] = 1

    m2 = compute_binary_metrics(y_pred, y_true, threshold=0.5)
    assert m2["recall"] == 1.0
    assert m2["precision"] == 0.5
    assert m2["iou"] == 0.5


def test_split_scenes_leakage_prevention():
    """Verify that patches from the same scene stay together in the same split"""
    paths = [
        "data/inria_austin1_patch0.png",
        "data/inria_austin1_patch1.png",
        "data/inria_austin1_patch2.png",
        "data/inria_vienna2_patch0.png",
        "data/inria_vienna2_patch1.png",
        "data/spacenet_vegas_patch0.png",
        "data/spacenet_vegas_patch1.png",
    ]

    splits = split_scenes_without_leakage(paths, train_ratio=0.6, val_ratio=0.2, seed=42)
    train_paths = [paths[i] for i in splits["train"]]
    val_paths = [paths[i] for i in splits["val"]]

    # austin1 patches should either all be in train or all be in val
    austin_in_train = any("inria_austin1" in p for p in train_paths)
    austin_in_val = any("inria_austin1" in p for p in val_paths)
    assert not (austin_in_train and austin_in_val), "Spatial leakage detected across splits!"


def test_inference_missing_checkpoint_honest_handling():
    """Verify that missing checkpoint raises error or requires explicit demo mode"""
    engine = InferenceEngine(checkpoint_path="./nonexistent_weights.pt")
    assert engine.model_loaded is False
    assert "not found" in engine.load_error.lower()

    dummy_img = np.zeros((128, 128, 3), dtype=np.uint8)

    # Without allow_demo_mode, it must raise RuntimeError
    with pytest.raises(RuntimeError):
        engine.predict_image(dummy_img, allow_demo_mode=False)

    # With allow_demo_mode, it succeeds but explicitly marks it as demo_synthetic
    mask, prob, meta = engine.predict_image(dummy_img, allow_demo_mode=True)
    assert meta["mode"] == "demo_synthetic"
    assert meta["is_genuine_ai"] is False
    assert len(meta["warnings"]) > 0
