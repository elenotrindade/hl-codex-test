export type ExportAction = 'download' | 'share';

export type ExportOutcome =
  | { status: 'downloaded'; filename: string }
  | { status: 'shared'; filename: string }
  | { status: 'cancelled'; filename: string }
  | { status: 'unsupported'; filename: string }
  | { status: 'failed'; message: string };

export type ExportAccess = {
  createObjectURL: typeof URL.createObjectURL;
  revokeObjectURL: typeof URL.revokeObjectURL;
  canShare?: Navigator['canShare'];
  share?: Navigator['share'];
  createAnchor?: () => HTMLAnchorElement;
  File?: typeof File;
};

const DEFAULT_FILENAME = 'yard-train.png';

function browserExportAccess(): ExportAccess {
  return {
    createObjectURL: URL.createObjectURL.bind(URL),
    revokeObjectURL: URL.revokeObjectURL.bind(URL),
    canShare: navigator.canShare?.bind(navigator),
    share: navigator.share?.bind(navigator),
  };
}

function dataUrlToBlob(imageDataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl);
  if (!match) throw new Error('Export image must be a PNG data URL');
  const [, mime, encoded] = match;
  if (mime !== 'image/png') throw new Error('Export image must be a PNG data URL');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function createFile(blob: Blob, filename: string, access: ExportAccess): File {
  const FileCtor = access.File ?? File;
  return new FileCtor([blob], filename, { type: blob.type, lastModified: Date.now() });
}

function createAnchor(access: ExportAccess): HTMLAnchorElement {
  return access.createAnchor?.() ?? document.createElement('a');
}

export async function exportTrainImage(imageDataUrl: string, action: ExportAction,
  access: ExportAccess = browserExportAccess(), filename = DEFAULT_FILENAME): Promise<ExportOutcome> {
  try {
    const blob = dataUrlToBlob(imageDataUrl);
    if (action === 'share') return await shareImage(blob, filename, access);
    return downloadImage(blob, filename, access);
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : 'Export failed' };
  }
}

async function shareImage(blob: Blob, filename: string, access: ExportAccess): Promise<ExportOutcome> {
  if (!access.share) return { status: 'unsupported', filename };
  const file = createFile(blob, filename, access);
  const data: ShareData = {
    files: [file],
    title: 'YARD / Train Canvas',
    text: 'A train painted in YARD.',
  };
  if (access.canShare && !access.canShare(data)) return { status: 'unsupported', filename };
  try {
    await access.share(data);
    return { status: 'shared', filename };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { status: 'cancelled', filename };
    throw error;
  }
}

function downloadImage(blob: Blob, filename: string, access: ExportAccess): ExportOutcome {
  const url = access.createObjectURL(blob);
  try {
    const anchor = createAnchor(access);
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
    return { status: 'downloaded', filename };
  } finally {
    access.revokeObjectURL(url);
  }
}
