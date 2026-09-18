export type DialogHandle = { close(): void };

export function openDialog(dialog: HTMLDialogElement, opener: HTMLElement, onClose?: () => void): DialogHandle {
  let closed = false;
  const restore = () => {
    if (closed) return;
    closed = true;
    dialog.removeEventListener('cancel', handleCancel);
    dialog.removeEventListener('click', handleBackdrop);
    dialog.removeEventListener('close', restore);
    onClose?.();
    opener.focus();
  };
  const handleCancel = () => setTimeout(restore);
  const handleBackdrop = (event: MouseEvent) => {
    if (event.target === dialog) dialog.close();
  };
  dialog.addEventListener('cancel', handleCancel);
  dialog.addEventListener('click', handleBackdrop);
  dialog.addEventListener('close', restore);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  return { close: () => { if (dialog.open) dialog.close(); else restore(); } };
}
