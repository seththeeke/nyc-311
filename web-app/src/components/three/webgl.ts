/*
 * Whether this browser can give us a WebGL2 context — MapLibre 6 and the
 * dive-in both need one. The probe context is released at once: browsers cap
 * live contexts (~16 in Chrome) and evict the oldest, so a page of avatar
 * checks used to knock out the shared avatar renderer.
 */
export function isWebGlAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (gl === null) return false;
    if (typeof gl.getExtension === "function") gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
