import { describe, expect, it, vi } from 'vitest';
import { mountSponsor, sponsorConfig, validateSponsor } from '../src/sponsorship';

class FakeAnchor {
  className = '';
  textContent: string | null = null;
  href = '';
  rel = '';
  target = '';
  addEventListener = vi.fn();
}

class FakeFooter {
  children: unknown[] = [];
  readonly savingNotice = 'Saved automatically after each stroke, in this browser only.';
  append = vi.fn((child: unknown) => { this.children.push(child); });
}

function harness(overrides: { createThrows?: boolean; appendThrows?: boolean } = {}) {
  const anchor = new FakeAnchor();
  const footer = new FakeFooter();
  if (overrides.appendThrows) footer.append = vi.fn(() => { throw new Error('append blocked'); });
  const doc = {
    createElement: vi.fn((tag: string) => {
      if (overrides.createThrows) throw new Error('create blocked');
      if (tag !== 'a') throw new Error(`unexpected tag ${tag}`);
      return anchor as unknown as HTMLAnchorElement;
    }),
  };
  return { anchor, doc, footer };
}

describe('sponsorship', () => {
  it('ships with production sponsorship disabled', () => {
    expect(sponsorConfig).toBeNull();
  });

  it('does not touch the document when sponsorship is null or undefined', () => {
    const setup = harness();
    expect(mountSponsor(setup.footer as unknown as HTMLElement, null, setup.doc)).toBe('disabled');
    expect(mountSponsor(setup.footer as unknown as HTMLElement, undefined, setup.doc)).toBe('disabled');
    expect(setup.doc.createElement).not.toHaveBeenCalled();
    expect(setup.footer.append).not.toHaveBeenCalled();
    expect(setup.footer.savingNotice).toContain('Saved automatically');
  });

  it.each([
    ['wrong shape', { label: 'Yard Supply', href: 'https://sponsor.example/yard' }],
    ['blank name', { name: '   ', url: 'https://sponsor.example/yard' }],
    ['malformed URL', { name: 'Yard Supply', url: 'https://%' }],
    ['relative URL', { name: 'Yard Supply', url: '/sponsor' }],
    ['HTTP URL', { name: 'Yard Supply', url: 'http://sponsor.example/yard' }],
    ['JavaScript URL', { name: 'Yard Supply', url: 'javascript:alert(1)' }],
    ['data URL', { name: 'Yard Supply', url: 'data:text/plain,sponsor' }],
    ['URL credentials', { name: 'Yard Supply', url: 'https://user:pass@sponsor.example/yard' }],
  ])('rejects %s without creating nodes', (_name, config) => {
    const setup = harness();
    expect(validateSponsor(config)).toBeNull();
    expect(mountSponsor(setup.footer as unknown as HTMLElement, config, setup.doc)).toBe('invalid');
    expect(setup.doc.createElement).not.toHaveBeenCalled();
    expect(setup.footer.append).not.toHaveBeenCalled();
  });

  it('mounts a disclosed HTTPS sponsor link with safe text and attributes', () => {
    const setup = harness();
    const config = { name: 'Yard <Supply> & Paint', url: 'https://sponsor.example/yard?slot=footer' };
    expect(mountSponsor(setup.footer as unknown as HTMLElement, config, setup.doc)).toBe('mounted');
    expect(setup.doc.createElement).toHaveBeenCalledWith('a');
    expect(setup.anchor.className).toBe('sponsor-link');
    expect(setup.anchor.textContent).toBe('Sponsored by Yard <Supply> & Paint (external site)');
    expect(setup.anchor.href).toBe('https://sponsor.example/yard?slot=footer');
    expect(setup.anchor.rel).toBe('sponsored noopener noreferrer');
    expect(setup.anchor.target).toBe('');
    expect(setup.anchor.addEventListener).not.toHaveBeenCalled();
    expect(setup.footer.children).toEqual([setup.anchor]);
  });

  it('trims harmless whitespace but keeps the approved destination string', () => {
    expect(validateSponsor({ name: '  Yard Supply  ', url: '  https://sponsor.example/yard  ' }))
      .toEqual({ name: 'Yard Supply', url: 'https://sponsor.example/yard' });
  });

  it('reports unavailable without altering the footer when the footer is missing', () => {
    const setup = harness();
    expect(mountSponsor(null, { name: 'Yard Supply', url: 'https://sponsor.example/yard' }, setup.doc)).toBe('unavailable');
    expect(setup.doc.createElement).not.toHaveBeenCalled();
    expect(setup.footer.append).not.toHaveBeenCalled();
  });

  it('reports unavailable when DOM construction or append fails', () => {
    const createFailure = harness({ createThrows: true });
    expect(mountSponsor(createFailure.footer as unknown as HTMLElement, { name: 'Yard Supply', url: 'https://sponsor.example/yard' }, createFailure.doc)).toBe('unavailable');
    expect(createFailure.footer.append).not.toHaveBeenCalled();

    const appendFailure = harness({ appendThrows: true });
    expect(mountSponsor(appendFailure.footer as unknown as HTMLElement, { name: 'Yard Supply', url: 'https://sponsor.example/yard' }, appendFailure.doc)).toBe('unavailable');
    expect(appendFailure.footer.children).toEqual([]);
    expect(appendFailure.footer.savingNotice).toContain('Saved automatically');
  });
});
