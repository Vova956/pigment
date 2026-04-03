/**
 * Copies text to the clipboard with a graceful execCommand fallback.
 * Single Responsibility: owns all clipboard interaction.
 */
export class ClipboardService {
  copyText(text: string, onSuccess: () => void): void {
    const fallback = () => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      onSuccess();
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(fallback);
    } else {
      fallback();
    }
  }
}
