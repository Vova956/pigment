import type { DrawingTool } from '../types/canvas';
import { DEFAULT_COLORS } from '../types/canvas';

interface ToolbarProps {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  disabled?: boolean;
}

export default function Toolbar({ tool, onToolChange, disabled = false }: ToolbarProps) {
  const handleColorChange = (color: string) => {
    onToolChange({ ...tool, color });
  };

  const handleWidthChange = (width: number) => {
    onToolChange({ ...tool, width });
  };

  const handleToolTypeChange = (type: DrawingTool['type']) => {
    onToolChange({ ...tool, type });
  };

  return (
    <div className={`toolbar ${disabled ? 'toolbar--disabled' : ''}`}>
      <div className="toolbar__section">
        <label className="toolbar__label">Tools</label>
        <div className="toolbar__tools">
          <button
            className={`toolbar__tool-btn ${tool.type === 'pen' ? 'toolbar__tool-btn--active' : ''}`}
            onClick={() => handleToolTypeChange('pen')}
            disabled={disabled}
            title="Pen"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
            <span>Pen</span>
          </button>
          <button
            className={`toolbar__tool-btn ${tool.type === 'eraser' ? 'toolbar__tool-btn--active' : ''}`}
            onClick={() => handleToolTypeChange('eraser')}
            disabled={disabled}
            title="Eraser"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M15.14 3.12L19.78 7.76L14.21 13.34L9.57 8.7L15.14 3.12M11.88 5.38L3.77 13.5L8.41 18.14L16.52 10.03L11.88 5.38M2.34 14.88L6.98 19.52L3.97 22.53L0 24L1.47 20.03L2.34 14.88Z" />
            </svg>
            <span>Eraser</span>
          </button>
          <button
            className={`toolbar__tool-btn ${tool.type === 'highlighter' ? 'toolbar__tool-btn--active' : ''}`}
            onClick={() => handleToolTypeChange('highlighter')}
            disabled={disabled}
            title="Highlighter"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M2 20h20v4H2v-4zm2-8h2v6H4v-6zm4-6h2v12H8V6zm4-4h2v16h-2V2zm4 4h2v12h-2V6zm4 6h2v6h-2v-6z" opacity="0.5" />
            </svg>
            <span>Highlighter</span>
          </button>
        </div>
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__section">
        <label className="toolbar__label">Stroke Width</label>
        <div className="toolbar__width-controls">
          {[1, 2, 3, 5, 8, 12, 20].map((width) => (
            <button
              key={width}
              className={`toolbar__width-btn ${tool.width === width ? 'toolbar__width-btn--active' : ''}`}
              onClick={() => handleWidthChange(width)}
              disabled={disabled}
              title={`${width}px`}
            >
              <div
                className="toolbar__width-preview"
                style={{
                  width: `${Math.min(width, 16)}px`,
                  height: `${Math.min(width, 16)}px`,
                  borderRadius: '50%',
                  backgroundColor: tool.width === width ? '#2196F3' : '#666',
                }}
              />
              <span>{width}px</span>
            </button>
          ))}
          <input
            type="range"
            min="1"
            max="100"
            value={tool.width}
            onChange={(e) => handleWidthChange(Number(e.target.value))}
            disabled={disabled}
            className="toolbar__width-slider"
          />
        </div>
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__section">
        <label className="toolbar__label">Color</label>
        <div className="toolbar__color-grid">
          {DEFAULT_COLORS.map((color) => (
            <button
              key={color}
              className={`toolbar__color-btn ${tool.color === color ? 'toolbar__color-btn--active' : ''}`}
              onClick={() => handleColorChange(color)}
              disabled={disabled || tool.type === 'eraser'}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <div className="toolbar__color-input-wrapper">
          <input
            type="color"
            value={tool.color}
            onChange={(e) => handleColorChange(e.target.value)}
            disabled={disabled || tool.type === 'eraser'}
            className="toolbar__color-input"
          />
          <span className="toolbar__color-value">{tool.color}</span>
        </div>
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__section toolbar__section--current">
        <label className="toolbar__label">Current Tool</label>
        <div className="toolbar__current-preview">
          <div
            className="toolbar__preview-cursor"
            style={{
              width: `${Math.min(tool.width * 1.5, 40)}px`,
              height: `${Math.min(tool.width * 1.5, 40)}px`,
              borderRadius: tool.type === 'highlighter' ? '2px' : '50%',
              backgroundColor: tool.type === 'eraser' ? '#fff' : tool.color,
              border: '2px solid #333',
              opacity: tool.type === 'highlighter' ? 0.4 : 1,
            }}
          />
          <span className="toolbar__preview-text">
            {tool.type.charAt(0).toUpperCase() + tool.type.slice(1)} • {tool.width}px
          </span>
        </div>
      </div>
    </div>
  );
}
