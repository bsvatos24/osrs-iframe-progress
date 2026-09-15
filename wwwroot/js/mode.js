// ============================================================
// Layout buckets.
//
// The app responds to the size of its own container, not to the device: the
// Edge offers three iframe slots (M 840x696, L 1688x696, XL 2536x696) that
// differ only in width, and a phone is narrow in the opposite direction. One
// ResizeObserver is the single source of truth, so CSS ([data-bucket]) and the
// JS that needs to know how many GIM panels fit can never disagree.
// ============================================================

import { config } from "./config.js";

// Aspect ratio (width / height) thresholds. These map 1:1 onto the Edge slots:
// XL is 3.64, L is 2.43, M is 1.21.
const THRESHOLDS = [
  { bucket: "xl", minAspect: 3.0 },
  { bucket: "l", minAspect: 2.0 },
  { bucket: "m", minAspect: 1.0 },
  { bucket: "tall", minAspect: 0 }
];

let current = null;
const listeners = new Set();

export function bucketFor(width, height) {
  if (config.bucketOverride) return config.bucketOverride;
  if (height <= 0) return "m";
  const aspect = width / height;
  for (const t of THRESHOLDS) {
    if (aspect >= t.minAspect) return t.bucket;
  }
  return "m";
}

export function getBucket() {
  return current || "m";
}

export function onBucketChange(fn) {
  listeners.add(fn);
}

export function observeBucket(element) {
  const apply = function (width, height) {
    const next = bucketFor(width, height);
    if (next === current) return;
    current = next;
    document.documentElement.dataset.bucket = next;
    listeners.forEach(function (fn) { fn(next); });
  };

  // Set it before the first paint so views never render into the wrong bucket.
  apply(element.clientWidth || window.innerWidth, element.clientHeight || window.innerHeight);

  const observer = new ResizeObserver(function (entries) {
    const box = entries[0].contentRect;
    apply(box.width, box.height);
  });
  observer.observe(element);
  return observer;
}