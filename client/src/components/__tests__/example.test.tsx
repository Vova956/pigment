import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Toolbar-like component stub ────────────────────────────────────────────────
// These tests verify fundamental React rendering and interaction patterns
// that mirror real component behaviour in the application.

interface ColourPickerProps {
  colours: string[];
  selected: string;
  onSelect: (colour: string) => void;
}

function ColourPicker({ colours, selected, onSelect }: ColourPickerProps) {
  return (
    <div role="group" aria-label="colour picker">
      {colours.map((c) => (
        <button
          key={c}
          aria-label={`colour ${c}`}
          aria-pressed={c === selected}
          style={{ background: c }}
          onClick={() => onSelect(c)}
        />
      ))}
    </div>
  );
}

interface ToolButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToolButton({ label, active, onClick }: ToolButtonProps) {
  return (
    <button aria-label={label} aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  );
}

// ── ColourPicker tests ────────────────────────────────────────────────────────

describe('ColourPicker', () => {
  const colours = ['#000000', '#FF0000', '#00FF00'];

  it('renders one button per colour', () => {
    render(<ColourPicker colours={colours} selected="#000000" onSelect={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(colours.length);
  });

  it('marks the selected colour as pressed', () => {
    render(<ColourPicker colours={colours} selected="#FF0000" onSelect={vi.fn()} />);
    const btn = screen.getByLabelText('colour #FF0000');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks non-selected colours as not pressed', () => {
    render(<ColourPicker colours={colours} selected="#FF0000" onSelect={vi.fn()} />);
    const black = screen.getByLabelText('colour #000000');
    expect(black).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelect with the clicked colour', () => {
    const onSelect = vi.fn();
    render(<ColourPicker colours={colours} selected="#000000" onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('colour #00FF00'));
    expect(onSelect).toHaveBeenCalledWith('#00FF00');
  });

  it('renders an empty group for an empty colours array', () => {
    render(<ColourPicker colours={[]} selected="" onSelect={vi.fn()} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

// ── ToolButton tests ──────────────────────────────────────────────────────────

describe('ToolButton', () => {
  it('renders with the provided label', () => {
    render(<ToolButton label="Pen" active={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Pen' })).toBeDefined();
  });

  it('reflects active state via aria-pressed', () => {
    render(<ToolButton label="Eraser" active={true} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Eraser' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ToolButton label="Lasso" active={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lasso' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick before any interaction', () => {
    const onClick = vi.fn();
    render(<ToolButton label="Text" active={false} onClick={onClick} />);
    expect(onClick).not.toHaveBeenCalled();
  });
});
