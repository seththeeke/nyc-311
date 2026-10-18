import { useEffect, useState } from "react";
import { isWebGlAvailable } from "../components/three/webgl";

/* One snapshot per model for the life of the page; null when it could not be drawn. */
const snapshots = new Map<string, string | null>();

/** Test hook: forget every snapshot. */
export function clearResidentAvatars(): void {
  snapshots.clear();
}

/**
 * A resident's head-and-shoulders snapshot as an image URL, or null —
 * no model, no WebGL, or not drawn yet — in which case the avatar shows
 * the initial. The renderer is imported on first use, keeping Three.js
 * out of the main bundle.
 */
export function useResidentAvatar(modelKey: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (modelKey ? (snapshots.get(modelKey) ?? null) : null));
  useEffect(() => {
    if (!modelKey) {
      setUrl(null);
      return undefined;
    }
    if (snapshots.has(modelKey)) {
      setUrl(snapshots.get(modelKey) ?? null);
      return undefined;
    }
    if (!isWebGlAvailable()) {
      snapshots.set(modelKey, null);
      setUrl(null);
      return undefined;
    }
    let live = true;
    import("../components/residents/models/avatarSnapshot")
      .then(({ renderResidentAvatar }) => renderResidentAvatar(modelKey))
      .catch(() => null)
      .then((drawn) => {
        snapshots.set(modelKey, drawn);
        if (live) setUrl(drawn);
      });
    return () => {
      live = false;
    };
  }, [modelKey]);
  return url;
}
