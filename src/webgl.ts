// WebGL capability probe, checked once per session. Viewer and Heightmap gate
// on it: a software-GL kiosk gets the 2D fallback / a clear note instead of a
// three.js throw or a silently blank Plotly box.

let cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    cached = gl !== null;
    // Release the probe context: browsers cap live GL contexts per page, and
    // the boolean is cached for the session anyway. Without this the probe
    // holds one context slot for the whole session.
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}
