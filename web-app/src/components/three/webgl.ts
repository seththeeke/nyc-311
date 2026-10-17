/* Whether this browser can give us a WebGL2 context — MapLibre 6 and the dive-in both need one. */
export function isWebGlAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null;
  } catch {
    return false;
  }
}
