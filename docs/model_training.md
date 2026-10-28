# Model Architecture & Training Methodology

**UrbanFootprint AI** utilizes a custom lightweight Residual U-Net (`BuildingUNet-Res`) specifically engineered for aerial building footprint segmentation.

---

## 1. Network Architecture (`ml/model.py`)

- **Encoder**: 4 downscaling stages with Residual Double-Convolution blocks (Conv2D 3×3, BatchNorm, ReLU, Residual 1×1 skip) and MaxPool2d. Feature progression: $32 \rightarrow 64 \rightarrow 128 \rightarrow 256$.
- **Bottleneck**: Dropout2d ($p=0.1$) to prevent overfitting on specific sensor color characteristics.
- **Decoder**: 4 upscaling stages with Bilinear Upsampling + Double-Convolution blocks concatenating fine spatial encoder features with semantic context.
- **Head**: 1×1 Convolution outputting raw unthresholded logits.

---

## 2. Loss Function: Combined BCE + Dice Loss

Standard cross-entropy alone suffers in building segmentation due to severe class imbalance (background pixels outnumber building pixels by 4:1 to 10:1 in rural/suburban scenes).

We employ a compound loss function:
$$\mathcal{L}_{\text{total}} = 0.5 \cdot \mathcal{L}_{\text{BCE}} + 0.5 \cdot \mathcal{L}_{\text{Dice}}$$

Where:
$$\mathcal{L}_{\text{Dice}} = 1 - \frac{2 \sum (p_i \cdot y_i) + \epsilon}{\sum p_i + \sum y_i + \epsilon}$$

- **BCE** ensures smooth pixel-level probability calibration.
- **Dice Loss** penalizes boundary fuzziness and drives the network to delineate crisp building corners.

---

## 3. Evaluation Metrics (`ml/evaluate.py`)

For any binary mask prediction $P$ and ground truth $Y$:
- **Intersection over Union (IoU)**:
  $$\text{IoU} = \frac{|P \cap Y|}{|P \cup Y|} = \frac{\text{TP}}{\text{TP} + \text{FP} + \text{FN}}$$
- **Dice Coefficient / F1-Score**:
  $$\text{F1} = \frac{2 \cdot \text{TP}}{2 \cdot \text{TP} + \text{FP} + \text{FN}}$$
- **Precision**: $\frac{\text{TP}}{\text{TP} + \text{FP}}$ (false positive suppression).
- **Recall**: $\frac{\text{TP}}{\text{TP} + \text{FN}}$ (small building detection).

---

## 4. Checkpointing & Reproducibility

Checkpoints are saved as PyTorch state dictionaries with embedded metadata:
- `epoch`: Current epoch number.
- `val_iou`: Best validation IoU achieved.
- `val_dice`: Validation Dice score.
- `is_synthetic`: Boolean indicating whether trained on synthetic or real data.
- `model_architecture`: Architectural identifier (`BuildingUNet-Res`).
- `created_at`: ISO timestamp.
