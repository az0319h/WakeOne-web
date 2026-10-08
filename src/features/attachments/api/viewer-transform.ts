export const VIEWER_ZOOM_MIN = 0.5;
export const VIEWER_ZOOM_MAX = 3;
export const VIEWER_ZOOM_STEP = 0.25;

export type ViewerTransform = {
  zoom: number;
  rotation: number;
};

export const DEFAULT_VIEWER_TRANSFORM: ViewerTransform = {
  zoom: 1,
  rotation: 0
};

export function clampZoom(value: number): number {
  return Math.min(VIEWER_ZOOM_MAX, Math.max(VIEWER_ZOOM_MIN, value));
}

export function zoomIn(current: number): number {
  return clampZoom(Number((current + VIEWER_ZOOM_STEP).toFixed(2)));
}

export function zoomOut(current: number): number {
  return clampZoom(Number((current - VIEWER_ZOOM_STEP).toFixed(2)));
}

export function rotateClockwise(current: number): number {
  return (current + 90) % 360;
}
