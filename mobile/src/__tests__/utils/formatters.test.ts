/**
 * Unit tests for formatting utilities
 */
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
} from '../../utils/formatters';

describe('Formatters', () => {
  describe('formatCurrency', () => {
    it('should format currency in BRL', () => {
      const result = formatCurrency(1000);
      expect(result).toContain('1');
      expect(result).toContain('000');
      // Should include currency symbol
      expect(result).toMatch(/R\$|BRL/i);
    });

    it('should handle zero', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0');
    });

    it('should handle decimal values', () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });

    it('should handle negative values', () => {
      const result = formatCurrency(-500);
      expect(result).toContain('500');
    });
  });

  describe('formatDate', () => {
    it('should format Date object', () => {
      const date = new Date('2026-02-06T10:00:00Z');
      const result = formatDate(date);
      // Should contain date parts
      expect(result).toContain('2026');
    });

    it('should format date string', () => {
      const result = formatDate('2026-02-06T10:00:00Z');
      expect(result).toContain('2026');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with locale', () => {
      const result = formatNumber(1000);
      expect(result).toContain('1');
      expect(result).toContain('000');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('should handle large numbers', () => {
      const result = formatNumber(1234567);
      expect(result).toContain('1');
      expect(result).toContain('234');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format minutes ago', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
      const result = formatRelativeTime(past);
      expect(result).toContain('30');
      expect(result).toContain('min');
    });

    it('should format hours ago', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
      const result = formatRelativeTime(past);
      expect(result).toContain('3');
      expect(result).toContain('h');
    });

    it('should format days ago', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const result = formatRelativeTime(past);
      expect(result).toContain('2');
      expect(result).toContain('d');
    });

    it('should accept string dates', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
      const result = formatRelativeTime(past);
      expect(result).toContain('min');
    });
  });
});
