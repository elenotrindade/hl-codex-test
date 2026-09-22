export type Sponsor = Readonly<{ name: string; url: string }>;
export type SponsorMountResult = 'mounted' | 'disabled' | 'invalid' | 'unavailable';

export const sponsorConfig: Sponsor | null = null;

export function validateSponsor(value: unknown): Sponsor | null {
  if (value == null || typeof value !== 'object') return null;
  const candidate = value as Partial<Record<keyof Sponsor, unknown>>;
  if (typeof candidate.name !== 'string' || typeof candidate.url !== 'string') return null;
  const name = candidate.name.trim();
  const url = candidate.url.trim();
  if (!name || !url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
  } catch {
    return null;
  }
  return { name, url };
}

export function mountSponsor(
  footer: HTMLElement | null,
  value: unknown,
  doc: Pick<Document, 'createElement'> = document,
): SponsorMountResult {
  if (value == null) return 'disabled';
  const sponsor = validateSponsor(value);
  if (!sponsor) return 'invalid';
  if (!footer) return 'unavailable';
  try {
    const link = doc.createElement('a');
    link.className = 'sponsor-link';
    link.textContent = `Sponsored by ${sponsor.name} (external site)`;
    link.href = sponsor.url;
    link.rel = 'sponsored noopener noreferrer';
    footer.append(link);
    return 'mounted';
  } catch {
    return 'unavailable';
  }
}
