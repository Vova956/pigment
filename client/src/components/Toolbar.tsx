import type { DrawingTool } from '../types/canvas';

const PALETTE_COLORS = [
  '#1a1a2e', '#e85d04', '#0d9488', '#7c3aed',
  '#e11d48', '#0284c7', '#d97706', '#ffffff',
];

interface ToolbarProps {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onUndo: () => void;
  onClear: () => void;
  onExport: () => void;
  disabled?: boolean;
}

export default function Toolbar({ tool, onToolChange, onUndo, onClear, onExport, disabled = false }: ToolbarProps) {
  const setType = (type: DrawingTool['type']) => onToolChange({ ...tool, type });
  const setColor = (color: string) => onToolChange({ ...tool, color });
  const setWidth = (width: number) => onToolChange({ ...tool, width });

  const dotSize = Math.min(Math.max(tool.width, 3), 22);

  return (
    <div className={`toolbar${disabled ? ' toolbar--disabled' : ''}`}>
      {/* Drawing tools */}
      <div className="tool-group">
        <button
          className={`tool-btn${tool.type === 'pen' ? ' active' : ''}`}
          onClick={() => setType('pen')}
          disabled={disabled}
          title="Pen"
        >
          <span className="tooltip">Pen (P)</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
        </button>
        <button
          className={`tool-btn${tool.type === 'highlighter' ? ' active' : ''}`}
          onClick={() => setType('highlighter')}
          disabled={disabled}
          title="Highlighter"
        >
          <span className="tooltip">Highlighter (H)</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            <path d="M2 2l7.586 7.586"/>
          </svg>
        </button>
        <button
          className={`tool-btn${tool.type === 'eraser' ? ' active' : ''}`}
          onClick={() => setType('eraser')}
          disabled={disabled}
          title="Eraser"
        >
          <span className="tooltip">Eraser (E)</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 20H7L3 16l10-10 7 7-4 4"/>
            <path d="M7 20l3-3"/>
          </svg>
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Color palette */}
      <div className="color-palette">
        {PALETTE_COLORS.map((color) => (
          <button
            key={color}
            className={`color-swatch${tool.color === color ? ' active' : ''}`}
            onClick={() => setColor(color)}
            disabled={disabled || tool.type === 'eraser'}
            style={{
              backgroundColor: color,
              boxShadow: color === '#ffffff' ? 'inset 0 0 0 1px #cbd5e1' : undefined,
            }}
            title={color}
          />
        ))}
        <div className="color-custom" title="Custom color">
          <input
            type="color"
            value={tool.color}
            onChange={(e) => setColor(e.target.value)}
            disabled={disabled || tool.type === 'eraser'}
          />
          <div className="color-custom-preview" style={{ background: tool.color }} />
        </div>
      </div>

      <div className="toolbar-separator" />

      {/* Brush size */}
      <div className="size-control">
        <span className="size-control-label">Size</span>
        <div className="size-preview">
          <div
            className="size-dot"
            style={{ width: dotSize, height: dotSize }}
          />
        </div>
        <input
          type="range"
          className="size-slider"
          min="1"
          max="60"
          value={tool.width}
          onChange={(e) => setWidth(Number(e.target.value))}
          disabled={disabled}
        />
        <span className="size-value">{tool.width}</span>
      </div>

      {/* Action buttons */}
      <div className="toolbar-actions">
        <button className="action-btn" onClick={onUndo} disabled={disabled} title="Undo (Ctrl+Z)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
          Undo
        </button>
        <button className="action-btn" onClick={onClear} disabled={disabled} title="Clear canvas">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Clear
        </button>
        <button className="action-btn save" onClick={onExport} disabled={disabled} title="Export as PNG">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Export
        </button>
      </div>
    </div>
  );
}
