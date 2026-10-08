export type ViewerSize = {
  width: number;
  height: number;
};

export function computeFitContentWidth(
  container: ViewerSize,
  content: ViewerSize,
  rotationDeg: number,
  zoom: number,
  minWidth = 1
): number {
  const availW = Math.max(0, container.width);
  const availH = Math.max(0, container.height);

  if (availW === 0 || availH === 0 || content.width === 0 || content.height === 0) {
    return minWidth;
  }

  const ratio = content.height / content.width;
  const rot = ((rotationDeg % 360) + 360) % 360;
  const swapped = rot === 90 || rot === 270;

  const fitWidth = swapped
    ? Math.min(availH, availW / ratio)
    : Math.min(availW, availH / ratio);

  return Math.max(minWidth, Math.floor(fitWidth * zoom));
}

export function computeFitContentSize(
  container: ViewerSize,
  content: ViewerSize,
  rotationDeg: number,
  zoom: number,
  minWidth = 1
): ViewerSize {
  const width = computeFitContentWidth(
    container,
    content,
    rotationDeg,
    zoom,
    minWidth
  );
  const aspectRatio = content.height / content.width;

  return {
    width,
    height: Math.round(width * aspectRatio)
  };
}

export function scaleFitSize(base: ViewerSize, zoom: number): ViewerSize {
  return {
    width: Math.round(base.width * zoom),
    height: Math.round(base.height * zoom)
  };
}

export function viewerNeedsScroll(zoom: number): boolean {
  return zoom > 1;
}

export function getViewportContentSize(element: HTMLElement): ViewerSize {
  const style = getComputedStyle(element);
  const paddingX =
    parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const paddingY =
    parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

  return {
    width: Math.max(0, element.clientWidth - paddingX),
    height: Math.max(0, element.clientHeight - paddingY)
  };
}
