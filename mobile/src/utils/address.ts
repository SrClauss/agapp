import { ProjectAddress } from '../api/projects';

export function formatProjectAddress(address?: ProjectAddress | string): string | undefined {
  if (!address) return undefined;
  if (typeof address === 'string') return address;
  if ((address as any).formatted) return (address as any).formatted;

  const parts: string[] = [];
  const addr: any = address;
  if (addr.name) parts.push(addr.name);
  if (addr.street) parts.push(addr.street);
  if (addr.district) parts.push(addr.district);
  if (addr.city) parts.push(addr.city);
  if (addr.region) parts.push(addr.region);
  if (addr.postalCode) parts.push(addr.postalCode || addr.postal_code);
  return parts.join(', ');
}

export default formatProjectAddress;
