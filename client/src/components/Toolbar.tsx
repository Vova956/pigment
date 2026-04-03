import { useRef } from 'react';
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
  onImageUpload: (file: File) => void;
  disabled?: boolean;
}

export default function Toolbar({ tool, onToolChange, onUndo, onClear, onExport, onImageUpload, disabled = false }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setType = (type: DrawingTool['type']) => onToolChange({ ...tool, type });
  const setColor = (color: string) => onToolChange({ ...tool, color });
  const setWidth = (width: number) => onToolChange({ ...tool, width });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImageUpload(file);
    // Reset so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  const dotSize = Math.min(Math.max(tool.width, 3), 22);
  const noColor = tool.type === 'eraser' || tool.type === 'lasso';
  const sizeLabel = tool.type === 'text' ? 'Font' : 'Size';

  return (
    <div className={`toolbar${disabled ? ' toolbar--disabled' : ''}`}>
      <div className="tool-group">
        <button
          className={`tool-btn${tool.type === 'pen' ? ' active' : ''}`}
          onClick={() => setType('pen')}
          disabled={disabled}
          title="Pen"
        >
          <span className="tooltip">Pen</span>
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
          <span className="tooltip">Highlighter</span>
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
          <span className="tooltip">Eraser</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 20H7L3 16l10-10 7 7-4 4"/>
            <path d="M7 20l3-3"/>
          </svg>
        </button>
        <button
          className={`tool-btn${tool.type === 'lasso' ? ' active' : ''}`}
          onClick={() => setType('lasso')}
          disabled={disabled}
          title="Lasso Select"
        >
          <span className="tooltip">Lasso Select</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2">
            <ellipse cx="12" cy="11" rx="9" ry="7"/>
            <line x1="12" y1="18" x2="12" y2="22" strokeDasharray="none"/>
            <line x1="9" y1="22" x2="15" y2="22" strokeDasharray="none"/>
          </svg>
        </button>
        <button
          className={`tool-btn${tool.type === 'text' ? ' active' : ''}`}
          onClick={() => setType('text')}
          disabled={disabled}
          title="Text"
        >
          <span className="tooltip">Text</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 7 4 4 20 4 20 7"/>
            <line x1="9" y1="20" x2="15" y2="20"/>
            <line x1="12" y1="4" x2="12" y2="20"/>
          </svg>
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Color palette — disabled for eraser / lasso */}
      <div className="color-palette">
        {PALETTE_COLORS.map((color) => (
          <button
            key={color}
            className={`color-swatch${tool.color === color ? ' active' : ''}`}
            onClick={() => setColor(color)}
            disabled={disabled || noColor}
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
            disabled={disabled || noColor}
          />
          <div className="color-custom-preview" style={{ background: tool.color }} />
        </div>
      </div>

      <div className="toolbar-separator" />

      {/* Brush / eraser size (hidden for lasso) */}
      {tool.type !== 'lasso' && (
        <div className="size-control">
          <span className="size-control-label">{sizeLabel}</span>
          <div className="size-preview">
            <div className="size-dot" style={{ width: dotSize, height: dotSize }} />
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
      )}

      <div className="toolbar-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="action-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Upload image"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Image
        </button>
        <button className="action-btn" onClick={onUndo} disabled={disabled} title="Undo">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
          Undo
        </button>
        <button className="action-btn" onClick={onClear} disabled={disabled} title="Clear all">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Clear
        </button>
        <button className="action-btn save" onClick={onExport} disabled={disabled} title="Export PNG">
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
