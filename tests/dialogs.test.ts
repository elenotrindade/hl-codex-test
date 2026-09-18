import { describe, expect, it } from 'vitest';
import { openDialog } from '../src/dialogs';

class FakeDialog extends EventTarget {
  open = false;
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
}

class FakeOpener {
  focused = false;
  focus() { this.focused = true; }
}

describe('dialog helpers', () => {
  it('opens and restores focus when closed', () => {
    const dialog = new FakeDialog();
    const opener = new FakeOpener();
    let closes = 0;
    const handle = openDialog(dialog as unknown as HTMLDialogElement, opener as unknown as HTMLElement, () => { closes++; });
    expect(dialog.open).toBe(true);
    handle.close();
    expect(dialog.open).toBe(false);
    expect(opener.focused).toBe(true);
    expect(closes).toBe(1);
  });
  it('restores focus after Escape cancel closes the dialog', () => {
    const dialog = new FakeDialog();
    const opener = new FakeOpener();
    openDialog(dialog as unknown as HTMLDialogElement, opener as unknown as HTMLElement);
    dialog.dispatchEvent(new Event('cancel'));
    dialog.close();
    expect(opener.focused).toBe(true);
  });
});
