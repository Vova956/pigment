/**
 * Handles file reading and dimension scaling for uploaded images.
 * Single Responsibility: owns all image-processing logic before a CanvasImage is created.
 */
export class ImageService {
  private static readonly MAX_DIMENSION = 600;

  static readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  static getScaledDimensions(
    naturalWidth: number,
    naturalHeight: number,
    maxDimension = ImageService.MAX_DIMENSION,
  ): { width: number; height: number } {
    const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    return {
      width: Math.round(naturalWidth * scale),
      height: Math.round(naturalHeight * scale),
    };
  }

  /** Reads a File and resolves with its data URL and scaled display dimensions. */
  static processFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
    return ImageService.readAsDataUrl(file).then(
      dataUrl => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const { width, height } = ImageService.getScaledDimensions(img.naturalWidth, img.naturalHeight);
          resolve({ dataUrl, width, height });
        };
        img.onerror = () => reject(new Error('Failed to decode image'));
        img.src = dataUrl;
      }),
    );
  }
}
