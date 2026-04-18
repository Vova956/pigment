import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClipboardService } from '../ClipboardService';

// ── Mock setup ────────────────────────────────────────────────────────────────

function mockNavigatorClipboard(writeText: (...args: any[]) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  });
}

function removeNavigatorClipboard() {
  Object.defineProperty(navigator, 'clipboard', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// ── Modern Clipboard API ──────────────────────────────────────────────────────

describe('ClipboardService.copyText — modern clipboard API', () => {
  let service: ClipboardService;

  beforeEach(() => {
    service = new ClipboardService();
  });

  it('calls navigator.clipboard.writeText with the provided text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockNavigatorClipboard(writeText);

    await new Promise<void>((resolve) => {
      service.copyText('hello world', resolve);
    });

    expect(writeText).toHaveBeenCalledWith('hello world');
  });

  it('invokes onSuccess callback when clipboard write resolves', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockNavigatorClipboard(writeText);
    const onSuccess = vi.fn();

    await new Promise<void>((resolve) => {
      service.copyText('test', () => {
        onSuccess();
        resolve();
      });
    });

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('falls back to execCommand when clipboard.writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    mockNavigatorClipboard(writeText);

    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    const removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node);

    await new Promise<void>((resolve) => {
      service.copyText('fallback text', resolve);
    });

    expect(execCommand).toHaveBeenCalledWith('copy');
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});

// ── Fallback (execCommand) path ───────────────────────────────────────────────

describe('ClipboardService.copyText — execCommand fallback', () => {
  let service: ClipboardService;

  beforeEach(() => {
    service = new ClipboardService();
    removeNavigatorClipboard();
    document.execCommand = vi.fn().mockReturnValue(true);
  });

  it('uses execCommand when navigator.clipboard is unavailable', () => {
    const onSuccess = vi.fn();
    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    const removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node);

    service.copyText('no clipboard api', onSuccess);

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(onSuccess).toHaveBeenCalledOnce();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
