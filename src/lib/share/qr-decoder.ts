type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorConstructor = { new (options: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };
export type Decode = (video: HTMLVideoElement) => Promise<string | null>;

/** Native BarcodeDetector where the browser has it (Android Chrome), jsQR everywhere else (iPhone Safari). */
export async function createDecoder(): Promise<Decode> {
  const Native = (globalThis as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
  if (Native) {
    try {
      const formats = await Native.getSupportedFormats?.();
      if (!formats || formats.includes("qr_code")) {
        const detector = new Native({ formats: ["qr_code"] });
        return async (source) => (await detector.detect(source))[0]?.rawValue ?? null;
      }
    } catch { /* Fall through to jsQR. */ }
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (source) => {
    if (!context || !source.videoWidth) return null;
    const scale = Math.min(1, 720 / Math.max(source.videoWidth, source.videoHeight));
    canvas.width = Math.round(source.videoWidth * scale);
    canvas.height = Math.round(source.videoHeight * scale);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}
