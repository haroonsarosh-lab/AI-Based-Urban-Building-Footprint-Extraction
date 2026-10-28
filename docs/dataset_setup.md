# Dataset Acquisition & Preparation Guide

This guide details how to acquire, preprocess, and structure aerial building segmentation datasets for **UrbanFootprint AI**.

---

## 1. Supported Benchmark Datasets

### A. SpaceNet Building Footprints
- **Sensor**: WorldView-2 and WorldView-3 satellites (Maxar Technologies).
- **Ground Resolution**: ~30 cm panchromatic, ~50 cm multispectral.
- **Coverage**: AOI 1 (Rio de Janeiro), AOI 2 (Las Vegas), AOI 3 (Paris), AOI 4 (Shanghai), AOI 5 (Khartoum).
- **License**: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).

#### Downloading via AWS Open Data:
```bash
# List available imagery in Las Vegas AOI
aws s3 ls s3://spacenet-dataset/spacenet/AOI_2_Vegas/ --no-sign-request

# Download RGB Pan-sharpened images
aws s3 cp s3://spacenet-dataset/spacenet/AOI_2_Vegas/srcData/rasterData/ ./data/datasets/spacenet/ --recursive --no-sign-request
```

---

### B. Inria Aerial Image Labeling Dataset
- **Provider**: Inria Sophia Antipolis - Méditerranée.
- **Coverage**: 810 km² over 5 urban areas (Austin, Chicago, Kitsap County, West Tyrol, Vienna).
- **Ground Resolution**: 0.3 m aerial orthorectified imagery (5000×5000 px tiles).
- **License**: Open Government Licence / Academic Research Use.

#### Downloading:
1. Visit the official portal: [project.inria.fr/aerialimagelabeling](https://project.inria.fr/aerialimagelabeling/).
2. Extract the archive into:
   - `data/datasets/images/`
   - `data/datasets/masks/`

---

## 2. Spatial Data Leakage Prevention

In geospatial computer vision, **random patch splitting is catastrophic**. If a large 5000×5000 aerial tile is sliced into 512×512 patches and shuffled randomly into train and test splits, adjacent patches from the same street end up in both sets. The network easily memorizes the local sun angle, roof textures, and road colors, giving a falsely high test score that fails in new cities.

### Our Solution (`ml/dataset.py:split_scenes_without_leakage`):
1. Each patch filename carries its origin scene prefix (e.g., `inria_austin1_patch04.png` → scene `inria_austin1`).
2. Patches are clustered by their parent scene ID.
3. Train/Val/Test splits are assigned at the **scene level**, ensuring all patches from a given neighborhood stay together in one split.

---

## 3. Synthetic Verification Dataset Mode

For continuous integration, unit testing, and automated environment evaluation:
```bash
.venv\Scripts\python.exe -m ml.train --synthetic --epochs 3 --batch-size 2
```
This invokes `ml/dataset.py:create_synthetic_dataset_disk`, generating realistic roof shapes, road networks, and ground truth masks. All outputs are explicitly stamped as **Synthetic Mode** in the report and API to preserve research integrity.
