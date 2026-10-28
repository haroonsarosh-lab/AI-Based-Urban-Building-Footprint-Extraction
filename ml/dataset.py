"""
UrbanFootprint AI - Dataset Management & Preprocessing
Provides dataset loading, patch preparation with spatial leakage prevention,
and a synthetic aerial patch generator for pipeline validation and unit testing.
"""

import os
import glob
import math
import hashlib
import numpy as np
from PIL import Image, ImageDraw
import torch
from torch.utils.data import Dataset
from typing import List, Tuple, Dict, Any, Optional


class BuildingDataset(Dataset):
    """
    PyTorch Dataset for paired aerial imagery and building segmentation masks.
    """

    def __init__(
        self,
        image_paths: List[str],
        mask_paths: List[str],
        transform=None,
        normalize: bool = True,
    ):
        assert len(image_paths) == len(mask_paths), "Images and masks must have identical lengths"
        self.image_paths = image_paths
        self.mask_paths = mask_paths
        self.transform = transform
        self.normalize = normalize

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        img_path = self.image_paths[idx]
        mask_path = self.mask_paths[idx]

        with Image.open(img_path) as img_pil:
            img_rgb = img_pil.convert("RGB")
            img_arr = np.array(img_rgb, dtype=np.float32) / 255.0

        with Image.open(mask_path) as mask_pil:
            mask_gray = mask_pil.convert("L")
            mask_arr = (np.array(mask_gray, dtype=np.float32) > 127).astype(np.float32)

        if self.normalize:
            # Standard ImageNet or Aerial statistics
            mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
            std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
            img_arr = (img_arr - mean) / std

        # Convert to Channel x Height x Width
        img_tensor = torch.from_numpy(img_arr.transpose(2, 0, 1)).float()
        mask_tensor = torch.from_numpy(mask_arr).unsqueeze(0).float()

        return img_tensor, mask_tensor


def split_scenes_without_leakage(
    image_paths: List[str],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    seed: int = 42,
) -> Dict[str, List[int]]:
    """
    Splits dataset indices into train/val/test by clustering scene/area identifiers.
    Prevents spatial leakage where overlapping patches from the same scene enter both train and test.
    """
    scene_groups: Dict[str, List[int]] = {}

    for idx, path in enumerate(image_paths):
        basename = os.path.basename(path)
        # Extract scene prefix (e.g., 'inria_vienna1_patch0' -> 'inria_vienna1' or 'AOI_2_Vegas_img12' -> 'AOI_2_Vegas')
        parts = basename.split("_")
        scene_id = "_".join(parts[:2]) if len(parts) >= 2 else parts[0].split(".")[0]
        scene_groups.setdefault(scene_id, []).append(idx)

    # Deterministic scene assignment
    scenes = sorted(list(scene_groups.keys()))
    rng = np.random.RandomState(seed)
    rng.shuffle(scenes)

    train_indices, val_indices, test_indices = [], [], []
    total_samples = len(image_paths)
    current_train = 0
    current_val = 0

    for scene in scenes:
        indices = scene_groups[scene]
        count = len(indices)
        if (current_train + count) / max(total_samples, 1) <= train_ratio or not train_indices:
            train_indices.extend(indices)
            current_train += count
        elif (current_val + count) / max(total_samples, 1) <= val_ratio or not val_indices:
            val_indices.extend(indices)
            current_val += count
        else:
            test_indices.extend(indices)

    # In case test is empty for small collections, ensure all sets have elements if possible
    if not test_indices and len(val_indices) > 1:
        test_indices.append(val_indices.pop())

    return {
        "train": sorted(train_indices),
        "val": sorted(val_indices),
        "test": sorted(test_indices),
    }


def generate_synthetic_aerial_patch(
    patch_size: int = 512,
    num_buildings: int = 8,
    seed: Optional[int] = None,
) -> Tuple[Image.Image, Image.Image, List[Dict[str, Any]]]:
    """
    Generates a deterministic synthetic aerial image and ground truth building mask.
    Clearly labeled as SYNTHETIC. Used for testing the segmentation pipeline,
    verifying polygon extraction algorithms, and automated unit tests.
    """
    if seed is not None:
        np.random.seed(seed)

    # 1. Base terrain texture (ground/grass/asphalt mix)
    base_color = (
        int(np.random.randint(65, 95)),
        int(np.random.randint(85, 120)),
        int(np.random.randint(60, 90)),
    )
    img = Image.new("RGB", (patch_size, patch_size), base_color)
    mask = Image.new("L", (patch_size, patch_size), 0)

    draw_img = ImageDraw.Draw(img)
    draw_mask = ImageDraw.Draw(mask)

    # Draw simulated road network
    road_width = int(np.random.randint(18, 30))
    road_y = int(np.random.randint(patch_size * 0.4, patch_size * 0.6))
    road_color = (55, 58, 62)
    draw_img.rectangle([(0, road_y - road_width // 2), (patch_size, road_y + road_width // 2)], fill=road_color)

    # Dashed center line
    dash_color = (220, 220, 220)
    for x in range(0, patch_size, 30):
        draw_img.line([(x, road_y), (x + 15, road_y)], fill=dash_color, width=2)

    buildings_meta = []
    # 2. Add realistic rectangular and L-shaped buildings
    for b_idx in range(num_buildings):
        # Choose side of road
        is_upper = (b_idx % 2 == 0)
        y_min_bound = 20 if is_upper else (road_y + road_width // 2 + 25)
        y_max_bound = (road_y - road_width // 2 - 70) if is_upper else (patch_size - 80)

        if y_max_bound <= y_min_bound:
            continue

        w = int(np.random.randint(35, 75))
        h = int(np.random.randint(35, 70))
        x = int(np.random.randint(20, patch_size - w - 20))
        y = int(np.random.randint(y_min_bound, y_max_bound))

        # Roof palette (concrete grey, terracotta red, slate blue, metallic beige)
        roof_palettes = [
            (185, 80, 65),   # Terracotta
            (210, 212, 218), # Light concrete
            (70, 85, 105),   # Slate
            (195, 185, 160), # Beige metal
            (140, 145, 150), # Flat commercial
        ]
        roof_color = roof_palettes[b_idx % len(roof_palettes)]
        # Add subtle noise/shading
        border_color = (max(0, roof_color[0] - 30), max(0, roof_color[1] - 30), max(0, roof_color[2] - 30))

        # Shape: rectangular or L-shape
        if b_idx % 3 == 0 and w > 45 and h > 45:
            # L-shaped polygon
            cut_w = w // 2
            cut_h = h // 2
            poly = [
                (x, y),
                (x + w, y),
                (x + w, y + cut_h),
                (x + cut_w, y + cut_h),
                (x + cut_w, y + h),
                (x, y + h),
            ]
            draw_img.polygon(poly, fill=roof_color, outline=border_color)
            draw_mask.polygon(poly, fill=255)
        else:
            # Rectangular
            poly = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
            draw_img.rectangle([(x, y), (x + w, y + h)], fill=roof_color, outline=border_color)
            draw_mask.rectangle([(x, y), (x + w, y + h)], fill=255)

        buildings_meta.append({
            "id": b_idx + 1,
            "bbox": [x, y, x + w, y + h],
            "polygon": poly,
        })

    # Add gentle noise to image for sensor simulation
    noise = np.random.normal(0, 4.0, (patch_size, patch_size, 3)).astype(np.int16)
    img_np = np.clip(np.array(img, dtype=np.int16) + noise, 0, 255).astype(np.uint8)
    img_noisy = Image.fromarray(img_np)

    return img_noisy, mask, buildings_meta


def create_synthetic_dataset_disk(
    output_dir: str,
    num_samples: int = 12,
    patch_size: int = 512,
    seed: int = 100,
) -> Dict[str, Any]:
    """
    Creates and saves a synthetic dataset on disk with train/val/test splits.
    Clearly records metadata that this is a synthetic verification dataset.
    """
    images_dir = os.path.join(output_dir, "images")
    masks_dir = os.path.join(output_dir, "masks")
    os.makedirs(images_dir, exist_ok=True)
    os.makedirs(masks_dir, exist_ok=True)

    img_paths, mask_paths = [], []

    for i in range(num_samples):
        img_name = f"synth_aerial_{i+1:03d}.png"
        mask_name = f"synth_mask_{i+1:03d}.png"
        img_p = os.path.join(images_dir, img_name)
        mask_p = os.path.join(masks_dir, mask_name)

        img, mask, _ = generate_synthetic_aerial_patch(
            patch_size=patch_size,
            num_buildings=np.random.randint(5, 12),
            seed=seed + i,
        )
        img.save(img_p, format="PNG")
        mask.save(mask_p, format="PNG")

        img_paths.append(img_p)
        mask_paths.append(mask_p)

    splits = split_scenes_without_leakage(img_paths, train_ratio=0.7, val_ratio=0.15, seed=seed)

    return {
        "dataset_name": "Synthetic Aerial Building Verification Set",
        "is_synthetic": True,
        "description": "Synthetically generated aerial patches used for testing the training/eval pipeline.",
        "num_samples": num_samples,
        "patch_size": patch_size,
        "image_paths": img_paths,
        "mask_paths": mask_paths,
        "splits": splits,
    }
