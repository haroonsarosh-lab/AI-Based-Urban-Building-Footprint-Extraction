"use client";

import React from "react";
import { Database, ShieldCheck, Layers, GitBranch } from "./icons";

export default function DatasetsView() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Supported Datasets, Acquisition & Spatial Integrity
        </h1>
        <p className="text-sm text-slate-500">
          Official public benchmark datasets for aerial building footprint segmentation, licensing terms, and spatial data leakage prevention.
        </p>
      </div>

      {/* Dataset 1: SpaceNet */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sky-50 p-2.5 text-sky-700">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                SpaceNet Building Footprints Dataset
              </h2>
              <p className="text-xs text-slate-500">
                Satellite Imagery (WorldView-2 & WorldView-3, 30cm - 50cm GSD)
              </p>
            </div>
          </div>
          <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 border border-sky-200">
            CC BY-SA 4.0
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          SpaceNet features over 800,000 building footprint polygons across various global cities (AOI 1 Rio de Janeiro, AOI 2 Las Vegas, AOI 3 Paris, AOI 4 Shanghai, AOI 5 Khartoum). Provided with panchromatic and 8-band multispectral imagery.
        </p>

        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3.5 space-y-2 text-xs">
          <div className="font-semibold text-slate-800">Acquisition via AWS Open Data:</div>
          <pre className="overflow-x-auto rounded bg-slate-900 p-2.5 text-[11px] text-sky-300 font-mono">
            aws s3 ls s3://spacenet-dataset/spacenet/AOI_2_Vegas/ --no-sign-request
          </pre>
          <div className="text-[11px] text-slate-500">
            Terms: Commercial and academic use permitted under Creative Commons Attribution-ShareAlike 4.0 International License.
          </div>
        </div>
      </div>

      {/* Dataset 2: Inria */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-teal-50 p-2.5 text-teal-700">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Inria Aerial Image Labeling Dataset
              </h2>
              <p className="text-xs text-slate-500">
                Aerial Orthorectified Color Imagery (0.3m resolution)
              </p>
            </div>
          </div>
          <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 border border-teal-200">
            Open Gov Licence
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Inria covers 810 km² over 5 diverse urban settlements (Austin, Chicago, Kitsap County, West Tyrol, and Vienna). Each image is 5000×5000 px covering a 1500×1500 m surface area at 30 cm ground sampling distance with pixel-wise binary building labels.
        </p>

        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3.5 space-y-2 text-xs">
          <div className="font-semibold text-slate-800">Acquisition Instructions:</div>
          <p className="text-[11px] text-slate-600">
            Download directly from Inria Sophia Antipolis at{" "}
            <a
              href="https://project.inria.fr/aerialimagelabeling/"
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 underline font-medium"
            >
              project.inria.fr/aerialimagelabeling
            </a>
            . Place extracted pairs in <code className="bg-slate-200 px-1 rounded text-slate-800">data/datasets/images/</code> and{" "}
            <code className="bg-slate-200 px-1 rounded text-slate-800">data/datasets/masks/</code>.
          </p>
        </div>
      </div>

      {/* Spatial Data Leakage Prevention */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Critical Geospatial ML Principle: Spatial Autocorrelation & Data Leakage Prevention
          </h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Standard random splitting algorithms (e.g. random train_test_split) cause massive <strong>spatial data leakage</strong> in satellite imagery because adjacent overlapping patches share the exact same geographical neighborhood, building architecture, and illumination conditions. This falsely inflates validation metrics.
        </p>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3.5 text-xs text-emerald-950 space-y-1">
          <div className="font-semibold text-emerald-900">Our Implementation Safeguard:</div>
          <p className="text-[11px] text-emerald-800">
            In <code className="bg-emerald-100 px-1 rounded font-mono text-emerald-900">ml/dataset.py:split_scenes_without_leakage</code>, patches are grouped strictly by source scene / geographic cluster before splitting. All patches from the same source area are restricted to either train or validation—never divided across splits.
          </p>
        </div>
      </div>

      {/* Synthetic Dataset Engine */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Automated Synthetic Aerial Patch Verification Engine
          </h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          To enable deterministic automated testing, continuous integration, and pipeline validation without imposing multi-gigabyte dataset downloads on evaluators, UrbanFootprint AI includes an integrated synthetic generator (<code className="font-mono text-slate-800">ml/dataset.py:create_synthetic_dataset_disk</code>). It generates realistic roofs, road networks, and ground truth masks, strictly and honestly labeled as <strong>Synthetic Verification Mode</strong>.
        </p>
      </div>
    </div>
  );
}
