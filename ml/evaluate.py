"""
UrbanFootprint AI - Segmentation Evaluation Metrics
Computes IoU, Dice Coefficient, Precision, Recall, and F1 Score for building footprints.
"""

import numpy as np
from typing import Dict, Any, Union
import torch


def compute_binary_metrics(
    y_pred: Union[np.ndarray, torch.Tensor],
    y_true: Union[np.ndarray, torch.Tensor],
    threshold: float = 0.5,
    eps: float = 1e-7,
) -> Dict[str, float]:
    """
    Computes standard segmentation benchmark metrics for building footprints.

    Parameters:
        y_pred: predicted probabilities or binary mask in range [0, 1]
        y_true: ground truth binary mask (0 or 1)
        threshold: binarization cutoff for probabilities
        eps: epsilon for numerical stability

    Returns:
        Dictionary with iou, dice, precision, recall, f1, true_positives,
        false_positives, false_negatives, true_negatives
    """
    if isinstance(y_pred, torch.Tensor):
        y_pred = y_pred.detach().cpu().numpy()
    if isinstance(y_true, torch.Tensor):
        y_true = y_true.detach().cpu().numpy()

    # Binarize
    pred_bin = (y_pred >= threshold).astype(np.uint8)
    true_bin = (y_true >= 0.5).astype(np.uint8)

    pred_bin = pred_bin.flatten()
    true_bin = true_bin.flatten()

    tp = float(np.sum((pred_bin == 1) & (true_bin == 1)))
    fp = float(np.sum((pred_bin == 1) & (true_bin == 0)))
    fn = float(np.sum((pred_bin == 0) & (true_bin == 1)))
    tn = float(np.sum((pred_bin == 0) & (true_bin == 0)))

    # Metrics
    precision = tp / (tp + fp + eps)
    recall = tp / (tp + fn + eps)
    f1 = 2 * (precision * recall) / (precision + recall + eps)
    iou = tp / (tp + fp + fn + eps)
    dice = (2.0 * tp) / (2.0 * tp + fp + fn + eps)
    accuracy = (tp + tn) / (tp + tn + fp + fn + eps)

    return {
        "iou": round(iou, 4),
        "dice": round(dice, 4),
        "f1_score": round(f1, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "accuracy": round(accuracy, 4),
        "tp": int(tp),
        "fp": int(fp),
        "fn": int(fn),
        "tn": int(tn),
        "threshold": threshold,
    }


def evaluate_dataset(
    model: torch.nn.Module,
    dataloader,
    device: str = "cpu",
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Evaluates a model over a DataLoader and computes dataset-wide aggregated metrics.
    """
    model.eval()
    total_tp, total_fp, total_fn, total_tn = 0, 0, 0, 0

    with torch.no_grad():
        for images, masks in dataloader:
            images = images.to(device)
            masks = masks.to(device)
            logits = model(images)
            probs = torch.sigmoid(logits)

            metrics = compute_binary_metrics(probs, masks, threshold=threshold)
            total_tp += metrics["tp"]
            total_fp += metrics["fp"]
            total_fn += metrics["fn"]
            total_tn += metrics["tn"]

    eps = 1e-7
    precision = total_tp / (total_tp + total_fp + eps)
    recall = total_tp / (total_tp + total_fn + eps)
    f1 = 2 * (precision * recall) / (precision + recall + eps)
    iou = total_tp / (total_tp + total_fp + total_fn + eps)
    dice = (2.0 * total_tp) / (2.0 * total_tp + total_fp + total_fn + eps)
    accuracy = (total_tp + total_tn) / (total_tp + total_tn + total_fp + total_fn + eps)

    return {
        "iou": round(iou, 4),
        "dice": round(dice, 4),
        "f1_score": round(f1, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "accuracy": round(accuracy, 4),
        "total_true_positives": total_tp,
        "total_false_positives": total_fp,
        "total_false_negatives": total_fn,
        "total_true_negatives": total_tn,
        "threshold": threshold,
    }
