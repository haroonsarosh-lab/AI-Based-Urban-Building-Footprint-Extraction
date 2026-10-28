"""
UrbanFootprint AI - Segmentation Model Training Pipeline
Implements reproducible training with BCE + Dice loss, validation monitoring,
and automatic checkpointing. Supports both real datasets (SpaceNet/Inria) and synthetic test mode.
"""

import os
import argparse
import json
import time
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset
from typing import Dict, Any

from ml.model import BuildingUNet
from ml.dataset import BuildingDataset, create_synthetic_dataset_disk
from ml.evaluate import compute_binary_metrics


class DiceLoss(nn.Module):
    """Smooth Dice Loss for binary segmentation"""

    def __init__(self, smooth: float = 1.0):
        super().__init__()
        self.smooth = smooth

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        probs = torch.sigmoid(logits)
        probs_flat = probs.view(-1)
        targets_flat = targets.view(-1)

        intersection = (probs_flat * targets_flat).sum()
        dice = (2.0 * intersection + self.smooth) / (probs_flat.sum() + targets_flat.sum() + self.smooth)
        return 1.0 - dice


class CombinedBCEDiceLoss(nn.Module):
    """Combines BCE with Dice loss for boundary-aware building segmentation"""

    def __init__(self, bce_weight: float = 0.5, dice_weight: float = 0.5):
        super().__init__()
        self.bce = nn.BCEWithLogitsLoss()
        self.dice = DiceLoss()
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        loss_bce = self.bce(logits, targets)
        loss_dice = self.dice(logits, targets)
        return self.bce_weight * loss_bce + self.dice_weight * loss_dice


def train_model(
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    epochs: int = 5,
    lr: float = 1e-3,
    device: str = "cpu",
    checkpoint_dir: str = "./data/checkpoints",
    model_name: str = "urban_unet",
    is_synthetic: bool = False,
) -> Dict[str, Any]:
    """
    Executes training and validation loop, checkpointing the best weights.
    """
    os.makedirs(checkpoint_dir, exist_ok=True)
    criterion = CombinedBCEDiceLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    model.to(device)
    best_iou = 0.0
    best_checkpoint_path = os.path.join(checkpoint_dir, f"{model_name}_best.pt")
    history = []

    print(f"[*] Starting training on {device} (Epochs: {epochs}, LR: {lr}, Synthetic: {is_synthetic})")

    for epoch in range(1, epochs + 1):
        start_time = time.time()
        model.train()
        running_loss = 0.0

        for images, masks in train_loader:
            images = images.to(device)
            masks = masks.to(device)

            optimizer.zero_grad()
            logits = model(images)
            loss = criterion(logits, masks)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)

        scheduler.step()
        train_loss = running_loss / max(len(train_loader.dataset), 1)

        # Validation
        model.eval()
        val_loss = 0.0
        val_tp, val_fp, val_fn = 0, 0, 0

        with torch.no_grad():
            for images, masks in val_loader:
                images = images.to(device)
                masks = masks.to(device)

                logits = model(images)
                loss = criterion(logits, masks)
                val_loss += loss.item() * images.size(0)

                probs = torch.sigmoid(logits)
                metrics = compute_binary_metrics(probs, masks, threshold=0.5)
                val_tp += metrics["tp"]
                val_fp += metrics["fp"]
                val_fn += metrics["fn"]

        val_loss = val_loss / max(len(val_loader.dataset), 1)
        eps = 1e-7
        val_iou = val_tp / (val_tp + val_fp + val_fn + eps)
        val_dice = (2.0 * val_tp) / (2.0 * val_tp + val_fp + val_fn + eps)
        epoch_duration = time.time() - start_time

        epoch_stats = {
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "val_loss": round(val_loss, 4),
            "val_iou": round(val_iou, 4),
            "val_dice": round(val_dice, 4),
            "duration_sec": round(epoch_duration, 2),
        }
        history.append(epoch_stats)
        print(f"Epoch [{epoch}/{epochs}] - Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val IoU: {val_iou:.4f} ({epoch_duration:.1f}s)")

        # Save checkpoint if best
        if val_iou >= best_iou or epoch == 1:
            best_iou = val_iou
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "val_iou": val_iou,
                    "val_dice": val_dice,
                    "is_synthetic": is_synthetic,
                    "model_architecture": "BuildingUNet-Res",
                    "n_channels": 3,
                    "n_classes": 1,
                    "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                },
                best_checkpoint_path,
            )

    # Save summary metadata
    meta_path = os.path.join(checkpoint_dir, f"{model_name}_metadata.json")
    summary = {
        "model_name": model_name,
        "is_synthetic": is_synthetic,
        "epochs": epochs,
        "best_val_iou": round(best_iou, 4),
        "checkpoint_path": best_checkpoint_path,
        "history": history,
        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    with open(meta_path, "w") as f:
        json.dump(summary, f, indent=2)

    return summary


def main():
    parser = argparse.ArgumentParser(description="UrbanFootprint AI - Segmentation Training Pipeline")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=2, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu", help="Device (cpu or cuda)")
    parser.add_argument("--synthetic", action="store_true", help="Generate and train on synthetic dataset for verification")
    parser.add_argument("--data-dir", type=str, default="./data/datasets", help="Root directory for dataset")
    parser.add_argument("--checkpoint-dir", type=str, default="./data/checkpoints", help="Directory to save checkpoints")
    parser.add_argument("--model-name", type=str, default="urban_unet", help="Checkpoint model name")

    args = parser.parse_args()

    if args.synthetic:
        print("[*] Generating synthetic aerial verification dataset...")
        synth_dir = os.path.join(args.data_dir, "synthetic_verification")
        ds_info = create_synthetic_dataset_disk(synth_dir, num_samples=8, patch_size=256)
        full_ds = BuildingDataset(ds_info["image_paths"], ds_info["mask_paths"])
        train_ds = Subset(full_ds, ds_info["splits"]["train"])
        val_ds = Subset(full_ds, ds_info["splits"]["val"] if ds_info["splits"]["val"] else ds_info["splits"]["train"])
    else:
        # Expecting real dataset formatted with images/ and masks/
        img_dir = os.path.join(args.data_dir, "images")
        mask_dir = os.path.join(args.data_dir, "masks")
        if not os.path.exists(img_dir) or not os.path.exists(mask_dir):
            raise FileNotFoundError(
                f"Dataset not found at {args.data_dir}. Use --synthetic for test mode or place SpaceNet/Inria pairs in {img_dir} and {mask_dir}."
            )
        import glob
        img_paths = sorted(glob.glob(os.path.join(img_dir, "*.*")))
        mask_paths = sorted(glob.glob(os.path.join(mask_dir, "*.*")))
        full_ds = BuildingDataset(img_paths, mask_paths)
        val_size = max(1, int(len(full_ds) * 0.2))
        train_ds = Subset(full_ds, list(range(len(full_ds) - val_size)))
        val_ds = Subset(full_ds, list(range(len(full_ds) - val_size, len(full_ds))))

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False)

    model = BuildingUNet(n_channels=3, n_classes=1, base_features=32)
    train_model(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        epochs=args.epochs,
        lr=args.lr,
        device=args.device,
        checkpoint_dir=args.checkpoint_dir,
        model_name=args.model_name,
        is_synthetic=args.synthetic,
    )


if __name__ == "__main__":
    main()
