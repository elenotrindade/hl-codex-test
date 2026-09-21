import { describe, expect, it, vi } from 'vitest';
import { exportTrainImage, type ExportAccess } from '../src/artwork-export';

const image = 'data:image/png;base64,aGVsbG8=';

function access(overrides: Partial<ExportAccess> = {}) {
  const anchor = { click: vi.fn(), href: '', download: '', rel: '' } as unknown as HTMLAnchorElement;
  const current: ExportAccess = {
    createObjectURL: vi.fn(() => 'blob:yard-train'),
    revokeObjectURL: vi.fn(),
    createAnchor: () => anchor,
    ...overrides,
  };
  return { access: current, anchor };
}

describe('artwork export', () => {
  it('downloads the PNG with an object URL and cleans it up', async () => {
    const setup = access();
    await expect(exportTrainImage(image, 'download', setup.access, 'train.png'))
      .resolves.toEqual({ status: 'downloaded', filename: 'train.png' });
    expect(setup.access.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/png' }));
    expect(setup.anchor.download).toBe('train.png');
    expect(setup.anchor.href).toBe('blob:yard-train');
    expect(setup.anchor.rel).toBe('noopener');
    expect(setup.anchor.click).toHaveBeenCalledOnce();
    expect(setup.access.revokeObjectURL).toHaveBeenCalledWith('blob:yard-train');
  });

  it('revokes the object URL when the download click fails', async () => {
    const anchor = { click: vi.fn(() => { throw new Error('blocked'); }), href: '', download: '', rel: '' } as unknown as HTMLAnchorElement;
    const setup = access({ createAnchor: () => anchor });
    await expect(exportTrainImage(image, 'download', setup.access)).resolves.toEqual({ status: 'failed', message: 'blocked' });
    expect(setup.access.revokeObjectURL).toHaveBeenCalledWith('blob:yard-train');
  });

  it('shares files when the native share capability accepts them', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn(() => true);
    const setup = access({ share, canShare });
    await expect(exportTrainImage(image, 'share', setup.access, 'yard.png'))
      .resolves.toEqual({ status: 'shared', filename: 'yard.png' });
    expect(canShare).toHaveBeenCalledWith(expect.objectContaining({ title: 'YARD / Train Canvas', text: expect.any(String), files: [expect.any(File)] }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }));
    expect(setup.access.createObjectURL).not.toHaveBeenCalled();
  });

  it('reports unsupported native sharing without falling back silently', async () => {
    await expect(exportTrainImage(image, 'share', access().access, 'yard.png'))
      .resolves.toEqual({ status: 'unsupported', filename: 'yard.png' });
    const setup = access({ share: vi.fn(), canShare: vi.fn(() => false) });
    await expect(exportTrainImage(image, 'share', setup.access, 'yard.png'))
      .resolves.toEqual({ status: 'unsupported', filename: 'yard.png' });
    expect(setup.access.share).not.toHaveBeenCalled();
  });

  it('distinguishes share cancellation from share failure', async () => {
    const cancelled = access({ share: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')) });
    await expect(exportTrainImage(image, 'share', cancelled.access, 'yard.png'))
      .resolves.toEqual({ status: 'cancelled', filename: 'yard.png' });
    const failed = access({ share: vi.fn().mockRejectedValue(new Error('share broke')) });
    await expect(exportTrainImage(image, 'share', failed.access, 'yard.png'))
      .resolves.toEqual({ status: 'failed', message: 'share broke' });
  });

  it('rejects non-PNG data URLs without creating a handoff', async () => {
    const setup = access({ share: vi.fn() });
    await expect(exportTrainImage('data:image/svg+xml;base64,PHN2Zy8+', 'share', setup.access))
      .resolves.toEqual({ status: 'failed', message: 'Export image must be a PNG data URL' });
    expect(setup.access.share).not.toHaveBeenCalled();
    expect(setup.access.createObjectURL).not.toHaveBeenCalled();
  });
});
