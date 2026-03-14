/**
 * General helper utilities
 */

function safeStringify(value: unknown, replacer?: (key: string, value: any) => any, space?: string | number) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, val) => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val as object)) {
        return '[Circular]';
      }
      seen.add(val as object);
    }
    if (replacer) {
      return replacer(key, val);
    }
    return val;
  }, space);
}

export function normalizeMessageForAlert(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => normalizeMessageForAlert(item)).join('\n');
  if (typeof value === 'object') {
    // Some APIs send { detail: ... } or { message: ... }
    const cast = value as any;
    if (cast.detail !== undefined) return normalizeMessageForAlert(cast.detail);
    if (cast.message !== undefined) return normalizeMessageForAlert(cast.message);
    // Fallback to JSON representation (handles circular refs)
    const json = safeStringify(value, undefined, 2);
    return json ?? String(value);
  }
  return String(value);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  return fn().catch((error) => {
    if (maxAttempts <= 1) {
      throw error;
    }
    return sleep(delay).then(() => retry(fn, maxAttempts - 1, delay));
  });
}
