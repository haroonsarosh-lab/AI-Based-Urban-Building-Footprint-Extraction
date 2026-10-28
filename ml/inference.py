"""
UrbanFootprint AI - Segmentation Inference Engine
Provides tiled inference with configurable overlap and smooth seam blending,
probability map generation, binary thresholding, and honest checkpoint status reporting.
"""

import os
import time
import math
import numpy as np
from PIL import Image
from typing import Dict, Any, Tuple, Optional, List
import torch

from ml.model import BuildingUNet, get_model


class InferenceEngine:
    """
    Manages building footprint segmentation model loading,
    tiled sliding-window inference, and output mask generation.
    """

    def __init__(
        self,
        checkpoint_path: Optional[str] = None,
        device_preference: str = "cpu",
        default_tile_size: int = 512,
        default_overlap: int = 64,
    ):
        self.checkpoint_path = checkpoint_path
        self.device = (
            "cuda"
            if device_preference == "cuda" and torch.cuda.is_available()
            else "cpu"
        )
        self.tile_size = default_tile_size
        self.overlap = default_overlap
        self.model: Optional[BuildingUNet] = None
        self.is_synthetic_model: bool = False
        self.model_loaded: bool = False
        self.load_error: Optional[str] = None
        self.checkpoint_metadata: Dict[str, Any] = {}

        self._init_model()

    def _init_model(self):
        """Loads model weights if checkpoint exists and is valid"""
        if not self.checkpoint_path or not os.path.isfile(self.checkpoint_path):
            self.model_loaded = False
            self.load_error = f"Checkpoint file not found: {self.checkpoint_path}"
            return

        try:
            checkpoint = torch.load(self.checkpoint_path, map_location=self.device, weights_only=False)
            model = BuildingUNet(n_channels=3, n_classes=1, base_features=32)

            if isinstance(checkpoint, dict):
                state_dict = checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))
                model.load_state_dict(state_dict)
                self.is_synthetic_model = checkpoint.get("is_synthetic", False)
                self.checkpoint_metadata = {
                    "epoch": checkpoint.get("epoch"),
                    "val_iou": checkpoint.get("val_iou"),
                    "val_dice": checkpoint.get("val_dice"),
                    "created_at": checkpoint.get("created_at"),
                    "is_synthetic": self.is_synthetic_model,
                }
            else:
                model = checkpoint

            model.to(self.device)
            model.eval()
            self.model = model
            self.model_loaded = True
            self.load_error = None
        except Exception as e:
            self.model_loaded = False
            self.load_error = f"Failed to load checkpoint: {str(e)}"

    def get_info(self) -> Dict[str, Any]:
        """Returns honest report of model status and device"""
        return {
            "model_architecture": "BuildingUNet-Res (Lightweight Res-UNet)",
            "model_loaded": self.model_loaded,
            "checkpoint_path": self.checkpoint_path,
            "is_synthetic_checkpoint": self.is_synthetic_model,
            "device": self.device,
            "cuda_available": torch.cuda.is_available(),
            "load_error": self.load_error,
            "checkpoint_metadata": self.checkpoint_metadata,
            "default_tile_size": self.tile_size,
            "default_overlap": self.overlap,
        }

    @staticmethod
    def create_blending_window(tile_size: int) -> np.ndarray:
        """
        Creates a 2D spline / Hann window to smoothly weight tile predictions
        near edges, eliminating border seam artifacts when overlapping.
        """
        hanning_1d = np.hanning(tile_size)
        # Prevent zero weights at exact boundary
        hanning_1d = np.clip(hanning_1d, 0.1, 1.0)
        window = np.outer(hanning_1d, hanning_1d)
        return window.astype(np.float32)

    def predict_image(
        self,
        image_np: np.ndarray,
        confidence_threshold: float = 0.50,
        tile_size: Optional[int] = None,
        overlap: Optional[int] = None,
        allow_demo_mode: bool = False,
    ) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
        """
        Runs tiled semantic segmentation over input image array (H x W x 3).

        Parameters:
            image_np: RGB image array of shape (H, W, 3) in range [0, 255] or [0, 1]
            confidence_threshold: binarization probability cutoff
            tile_size: tile window size (pixels)
            overlap: pixel overlap between adjacent tiles
            allow_demo_mode: if True and model not loaded, generates a labeled synthetic demo mask

        Returns:
            binary_mask: uint8 array (H, W) where 255 = building, 0 = background
            probability_map: float32 array (H, W) with probabilities in [0.0, 1.0]
            metadata: timing, warnings, and inference details
        """
        start_time = time.time()
        h, w = image_np.shape[:2]
        tile_sz = tile_size or self.tile_size
        stride = tile_sz - (overlap or self.overlap)
        stride = max(16, stride)

        warnings_list: List[str] = []

        if not self.model_loaded:
            if allow_demo_mode:
                warnings_list.append(
                    "MODEL CHECKPOINT NOT FOUND. Operating in explicitly labeled DEMO / SYNTHETIC TEST MODE. Predictions are simulated for pipeline testing."
                )
                prob_map = self._generate_demo_predictions(image_np)
                binary_mask = (prob_map >= confidence_threshold).astype(np.uint8) * 255
                inference_sec = time.time() - start_time
                return binary_mask, prob_map, {
                    "mode": "demo_synthetic",
                    "inference_time_seconds": round(inference_sec, 3),
                    "warnings": warnings_list,
                    "tiles_processed": 0,
                    "is_genuine_ai": False,
                }
            else:
                raise RuntimeError(
                    f"Model checkpoint is not loaded ({self.load_error or 'no checkpoint specified'}). Train a model or enable demo mode with explicit notice."
                )

        # Genuine AI Inference
        prob_sum = np.zeros((h, w), dtype=np.float32)
        weight_sum = np.zeros((h, w), dtype=np.float32)
        window = self.create_blending_window(tile_sz)

        # Mean/std for normalization
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

        # Normalize image to float in [0, 1]
        if image_np.dtype == np.uint8:
            img_norm = image_np.astype(np.float32) / 255.0
        else:
            img_norm = image_np.astype(np.float32)

        tiles_processed = 0
        y_starts = list(range(0, max(1, h - tile_sz + 1), stride))
        if y_starts[-1] + tile_sz < h:
            y_starts.append(h - tile_sz)

        x_starts = list(range(0, max(1, w - tile_sz + 1), stride))
        if x_starts[-1] + tile_sz < w:
            x_starts.append(w - tile_sz)

        with torch.no_grad():
            for y in y_starts:
                y = max(0, min(y, h - tile_sz)) if h >= tile_sz else 0
                actual_h = min(tile_sz, h)
                for x in x_starts:
                    x = max(0, min(x, w - tile_sz)) if w >= tile_sz else 0
                    actual_w = min(tile_sz, w)

                    patch = img_norm[y : y + actual_h, x : x + actual_w]
                    # Pad patch if smaller than tile_sz (e.g. image smaller than tile)
                    pad_y = tile_sz - patch.shape[0]
                    pad_x = tile_sz - patch.shape[1]
                    if pad_y > 0 or pad_x > 0:
                        patch = np.pad(patch, ((0, pad_y), (0, pad_x), (0, 0)), mode="reflect")

                    # Normalize
                    patch_std = (patch - mean) / std
                    patch_tensor = (
                        torch.from_numpy(patch_std.transpose(2, 0, 1))
                        .unsqueeze(0)
                        .float()
                        .to(self.device)
                    )

                    logits = self.model(patch_tensor)
                    tile_prob = torch.sigmoid(logits).squeeze().cpu().numpy()

                    # Crop padding if applied
                    tile_prob_crop = tile_prob[:actual_h, :actual_w]
                    curr_window = window[:actual_h, :actual_w]

                    prob_sum[y : y + actual_h, x : x + actual_w] += tile_prob_crop * curr_window
                    weight_sum[y : y + actual_h, x : x + actual_w] += curr_window
                    tiles_processed += 1

        # Avoid division by zero
        weight_sum = np.maximum(weight_sum, 1e-6)
        prob_map = np.clip(prob_sum / weight_sum, 0.0, 1.0)
        binary_mask = (prob_map >= confidence_threshold).astype(np.uint8) * 255

        inference_sec = time.time() - start_time
        meta = {
            "mode": "real_inference",
            "inference_time_seconds": round(inference_sec, 3),
            "tiles_processed": tiles_processed,
            "device": self.device,
            "is_synthetic_checkpoint": self.is_synthetic_model,
            "is_genuine_ai": True,
            "warnings": warnings_list,
        }
        return binary_mask, prob_map, meta

    def _generate_demo_predictions(self, image_np: np.ndarray) -> np.ndarray:
        """
        Deterministic, image-derived edge and structural feature detector
        used exclusively for fallback demo mode when no checkpoint is present.
        """
        import cv2
        h, w = image_np.shape[:2]
        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY) if image_np.ndim == 3 else image_np
        # Adaptive morphological building-like structure detection
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 40, 120)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
        closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        prob_map = cv2.GaussianBlur(closed.astype(np.float32) / 255.0, (7, 7), 0)
        return np.clip(prob_map * 0.9, 0.0, 1.0)
