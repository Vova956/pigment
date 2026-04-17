import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasExporter } from '../CanvasExporter';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSvgElement(overrides: Partial<{ clientWidth: number; clientHeight: number }> = {}): SVGSVGElement {
  return { clientWidth: 800, clientHeight: 600, ...overrides } as unknown as SVGSVGElement;
}

function setupXmlSerializer(returnValue = '<svg></svg>') {
  const serializeToString = vi.fn().mockReturnValue(returnValue);
  vi.stubGlobal(
    'XMLSerializer',
    class {
      serializeToString = serializeToString;
    },
  );
  return { serializeToString };
}

function setupUrlMocks() {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
}

function setupDocumentMocks() {
  const ctx = {
    fillStyle: '' as string,
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };

  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(ctx),
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,abc'),
  };

  const mockAnchor = { download: '', href: '', click: vi.fn() };

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return mockCanvas as unknown as HTMLElement;
    if (tag === 'a') return mockAnchor as unknown as HTMLElement;
    return document.createElement(tag);
  });

  return { ctx, mockCanvas, mockAnchor };
}

// ── CanvasExporter tests ──────────────────────────────────────────────────────

describe('CanvasExporter.exportToPng', () => {
  let exporter: CanvasExporter;

  beforeEach(() => {
    exporter = new CanvasExporter();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('calls XMLSerializer.serializeToString on the SVG element', () => {
    const { serializeToString } = setupXmlSerializer();
    setupUrlMocks();
    const svg = makeSvgElement();

    exporter.exportToPng(svg);

    expect(serializeToString).toHaveBeenCalledWith(svg);
  });

  it('creates an object URL from the serialized blob', () => {
    setupXmlSerializer();
    setupUrlMocks();
    const svg = makeSvgElement();

    exporter.exportToPng(svg);

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it('triggers canvas drawing and anchor click when image loads', () => {
    setupXmlSerializer();
    setupUrlMocks();
    const { ctx, mockAnchor } = setupDocumentMocks();
    const svg = makeSvgElement({ clientWidth: 1024, clientHeight: 768 });

    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        set src(_: string) { this.onload?.(); }
      },
    );

    exporter.exportToPng(svg);

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('can be called multiple times without errors', () => {
    setupXmlSerializer();
    setupUrlMocks();
    setupDocumentMocks();
    const svg = makeSvgElement();

    expect(() => {
      exporter.exportToPng(svg);
      exporter.exportToPng(svg);
    }).not.toThrow();
  });

  it('sets canvas dimensions to match the SVG element', () => {
    setupXmlSerializer();
    setupUrlMocks();
    const { mockCanvas } = setupDocumentMocks();
    const svg = makeSvgElement({ clientWidth: 1920, clientHeight: 1080 });

    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        set src(_: string) { this.onload?.(); }
      },
    );

    exporter.exportToPng(svg);

    expect(mockCanvas.width).toBe(1920);
    expect(mockCanvas.height).toBe(1080);
  });
});
