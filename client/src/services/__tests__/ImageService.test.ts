import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageService } from '../ImageService';

// ── getScaledDimensions ───────────────────────────────────────────────────────

describe('ImageService.getScaledDimensions', () => {
  it('leaves small images unscaled (scale capped at 1)', () => {
    const { width, height } = ImageService.getScaledDimensions(100, 200);
    expect(width).toBe(100);
    expect(height).toBe(200);
  });

  it('scales down wide images so the larger side matches maxDimension', () => {
    const { width, height } = ImageService.getScaledDimensions(1200, 600);
    expect(width).toBe(600);
    expect(height).toBe(300);
  });

  it('scales down tall images so the larger side matches maxDimension', () => {
    const { width, height } = ImageService.getScaledDimensions(400, 2000);
    // scale = 600/2000 = 0.3 → width = 120, height = 600
    expect(width).toBe(120);
    expect(height).toBe(600);
  });

  it('respects a custom maxDimension override', () => {
    const { width, height } = ImageService.getScaledDimensions(1000, 500, 200);
    expect(width).toBe(200);
    expect(height).toBe(100);
  });

  it('rounds dimensions to the nearest integer', () => {
    const { width, height } = ImageService.getScaledDimensions(333, 999);
    // scale = 600/999 ≈ 0.6006 → width ≈ 200, height ≈ 600
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
  });

  it('handles square inputs correctly', () => {
    const { width, height } = ImageService.getScaledDimensions(1000, 1000);
    expect(width).toBe(600);
    expect(height).toBe(600);
  });
});

// ── readAsDataUrl ─────────────────────────────────────────────────────────────

describe('ImageService.readAsDataUrl', () => {
  let originalReader: typeof FileReader;

  beforeEach(() => {
    originalReader = globalThis.FileReader;
  });

  afterEach(() => {
    globalThis.FileReader = originalReader;
  });

  it('resolves with the data URL when the read succeeds', async () => {
    const fakeUrl = 'data:image/png;base64,xyz';
    class MockReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onload?.({ target: { result: fakeUrl } }), 0);
      }
    }
    globalThis.FileReader = MockReader as unknown as typeof FileReader;

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(ImageService.readAsDataUrl(file)).resolves.toBe(fakeUrl);
  });

  it('rejects when the reader errors', async () => {
    class MockReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    globalThis.FileReader = MockReader as unknown as typeof FileReader;

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(ImageService.readAsDataUrl(file)).rejects.toThrow('Failed to read file');
  });
});

// ── processFile ───────────────────────────────────────────────────────────────

describe('ImageService.processFile', () => {
  let originalReader: typeof FileReader;
  let originalImage: typeof Image;

  beforeEach(() => {
    originalReader = globalThis.FileReader;
    originalImage = globalThis.Image;
  });

  afterEach(() => {
    globalThis.FileReader = originalReader;
    globalThis.Image = originalImage;
  });

  it('resolves with the data URL and scaled dimensions', async () => {
    const fakeUrl = 'data:image/png;base64,yyz';

    class MockReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onload?.({ target: { result: fakeUrl } }), 0);
      }
    }
    globalThis.FileReader = MockReader as unknown as typeof FileReader;

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1200;
      naturalHeight = 600;
      set src(_: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    globalThis.Image = MockImage as unknown as typeof Image;

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const result = await ImageService.processFile(file);

    expect(result.dataUrl).toBe(fakeUrl);
    expect(result.width).toBe(600);
    expect(result.height).toBe(300);
  });

  it('rejects when the image fails to decode', async () => {
    class MockReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onload?.({ target: { result: 'data:,bad' } }), 0);
      }
    }
    globalThis.FileReader = MockReader as unknown as typeof FileReader;

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    globalThis.Image = MockImage as unknown as typeof Image;

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(ImageService.processFile(file)).rejects.toThrow('Failed to decode image');
  });
});
