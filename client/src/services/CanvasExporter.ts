/**
 * Handles exporting the SVG canvas to a PNG file.
 * Single Responsibility: owns all export/serialisation logic.
 */
export class CanvasExporter {
  exportToPng(svg: SVGSVGElement): void {
    // Clone the live SVG so we can strip UI-only elements without touching the DOM
    const clone = svg.cloneNode(true) as SVGSVGElement;

    // Remove any elements tagged as export-excluded (cursors, lasso preview, etc.)
    clone.querySelectorAll('[data-export-exclude="true"]').forEach(el => el.remove());

    // Ensure the clone has explicit pixel dimensions for canvas rendering
    clone.setAttribute('width', String(svg.clientWidth));
    clone.setAttribute('height', String(svg.clientHeight));

    const str = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svg.clientWidth;
      canvas.height = svg.clientHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const a = document.createElement('a');
        a.download = `pigment-${Date.now()}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
}
