export function maskName(fullName?: string | null): string {
  if (!fullName) return '—';
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 0) return '—';

  const first = parts[0];
  const firstShown = first.length <= 7 ? first : first.slice(0, 7);
  const firstMaskedRemainder = first.length > 7 ? '*'.repeat(first.length - 7) : '';

  const restMasked = parts.slice(1).map(p => '*'.repeat(p.length)).join(' ');

  return [firstShown + firstMaskedRemainder, restMasked].filter(Boolean).join(' ');
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return '—';
  const s = String(phone).replace(/\s+/g, '');
  if (s.length <= 4) return s;
  const middle = '*'.repeat(Math.max(0, s.length - 4));
  return s.slice(0, 2) + middle + s.slice(-2);
}