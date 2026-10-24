import {
  MAX_IMAGE_FILE_BYTES,
  containRect,
  isLossyFormat,
  mimeForFormat,
  placeholderFontSize,
  validateCanvasSize,
  type ImageFormat,
} from "./logic";

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|bmp|avif|svg|ico|tiff?)$/i;
const encodeSupport = new Map<string, Promise<boolean>>();

export interface LoadedImage {
  image: HTMLImageElement;
  width: number;
  height: number;
  dispose: () => void;
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (file.size === 0) throw new Error("This file is empty.");
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error(
      `Choose an image under ${Math.round(MAX_IMAGE_FILE_BYTES / 1024 / 1024)} MB.`,
    );
  }
  if (!file.type.startsWith("image/") && !IMAGE_EXTENSION.test(file.name)) {
    throw new Error("Choose an image file such as PNG, JPEG, WebP, GIF, or SVG.");
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    image.src = "";
    URL.revokeObjectURL(url);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image could not be decoded in your browser."));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("The image has no pixel dimensions.");
    }
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const problem = validateCanvasSize(width, height);
  if (problem) throw new Error(problem);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("The browser could not encode this image."));
        },
        mime,
        quality,
      );
    } catch {
      reject(new Error("The browser could not encode this image."));
    }
  });
}

export async function encodeImage(
  image: HTMLImageElement,
  width: number,
  height: number,
  format: ImageFormat,
  quality = 0.9,
): Promise<{ blob: Blob; mime: string; requestedMime: string }> {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available in this browser.");
  if (format === "jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const requested = mimeForFormat(format);
  const blob = await canvasToBlob(
    canvas,
    requested.mime,
    isLossyFormat(format) ? Math.min(1, Math.max(0.01, quality)) : undefined,
  );
  return { blob, mime: blob.type || requested.mime, requestedMime: requested.mime };
}

export async function cropImage(
  image: HTMLImageElement,
  rect: { x: number; y: number; width: number; height: number },
  format: ImageFormat,
  quality = 0.9,
): Promise<{ blob: Blob; mime: string; requestedMime: string }> {
  const canvas = createCanvas(rect.width, rect.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available in this browser.");
  if (format === "jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, rect.width, rect.height);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );

  const requested = mimeForFormat(format);
  const blob = await canvasToBlob(
    canvas,
    requested.mime,
    isLossyFormat(format) ? Math.min(1, Math.max(0.01, quality)) : undefined,
  );
  return { blob, mime: blob.type || requested.mime, requestedMime: requested.mime };
}

export async function renderSquarePng(
  image: HTMLImageElement,
  size: number,
): Promise<Blob> {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available in this browser.");
  context.clearRect(0, 0, size, size);
  const rect = containRect(image.naturalWidth, image.naturalHeight, size, size);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  return canvasToBlob(canvas, "image/png");
}

export function canEncodeImageType(mime: string): Promise<boolean> {
  const cached = encodeSupport.get(mime);
  if (cached) return cached;
  const check = (async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    try {
      const blob = await canvasToBlob(canvas, mime);
      return blob.type === mime;
    } catch {
      return false;
    }
  })();
  encodeSupport.set(mime, check);
  return check;
}

export function renderPlaceholder(
  width: number,
  height: number,
  background: string,
  textColor: string,
  label: string,
): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available in this browser.");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  const text = label.trim();
  if (text) {
    context.font = `600 ${placeholderFontSize(width, height, text.length)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = textColor;
    context.fillText(text, width / 2, height / 2, width * 0.9);
  }
  return canvas;
}

export function sampleImage(image: HTMLImageElement, maxEdge: number): ImageData {
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas pixel access is not available in this browser.");
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}
