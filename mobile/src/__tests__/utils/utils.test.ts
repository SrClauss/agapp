/**
 * Unit tests for utility functions
 */

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      const { formatCurrency } = require('../../utils/formatters');
      
      const result = formatCurrency(1000);
      
      expect(result).toContain('1');
      expect(result).toContain('000');
    });

    it('should handle zero', () => {
      const { formatCurrency } = require('../../utils/formatters');
      
      const result = formatCurrency(0);
      
      expect(result).toContain('0');
    });
  });

  describe('validateCPF', () => {
    it('should validate correct CPF format', () => {
      const { validateCPF } = require('../../utils/validators');
      
      expect(validateCPF('12345678900')).toBe(true);
      expect(validateCPF('123.456.789-00')).toBe(true);
    });

    it('should invalidate incorrect CPF', () => {
      const { validateCPF } = require('../../utils/validators');
      
      expect(validateCPF('00000000000')).toBe(false);
      expect(validateCPF('12345')).toBe(false);
      expect(validateCPF('')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email', () => {
      const { validateEmail } = require('../../utils/validators');
      
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should invalidate incorrect email', () => {
      const { validateEmail } = require('../../utils/validators');
      
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const { calculateDistance } = require('../../utils/geo');
      
      const sp = { latitude: -23.5505, longitude: -46.6333 };
      const rio = { latitude: -22.9068, longitude: -43.1729 };
      
      const distance = calculateDistance(sp, rio);
      
      expect(distance).toBeGreaterThan(350);
      expect(distance).toBeLessThan(500);
    });

    it('should return 0 for same location', () => {
      const { calculateDistance } = require('../../utils/geo');
      
      const location = { latitude: -23.5505, longitude: -46.6333 };
      const distance = calculateDistance(location, location);
      
      expect(distance).toBe(0);
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const { truncateText } = require('../../utils/text');
      
      const longText = 'This is a very long text that should be truncated';
      const truncated = truncateText(longText, 20);
      
      expect(truncated.length).toBeLessThanOrEqual(23);
      expect(truncated).toContain('...');
    });

    it('should not truncate short text', () => {
      const { truncateText } = require('../../utils/text');
      
      const shortText = 'Short';
      const result = truncateText(shortText, 20);
      
      expect(result).toBe(shortText);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const { debounce } = require('../../utils/helpers');
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      expect(mockFn).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(500);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    afterAll(() => {
      jest.useRealTimers();
    });
  });

  describe('groupBy', () => {
    it('should group array by key', () => {
      const { groupBy } = require('../../utils/array');
      
      const items = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ];
      
      const grouped = groupBy(items, 'category');
      
      expect(grouped.A).toHaveLength(2);
      expect(grouped.B).toHaveLength(1);
    });
  });

  describe('sortByDate', () => {
    it('should sort items by date descending', () => {
      const { sortByDate } = require('../../utils/array');
      
      const items = [
        { created_at: '2025-01-22' },
        { created_at: '2025-01-20' },
        { created_at: '2025-01-25' },
      ];
      
      const sorted = sortByDate(items, 'created_at', 'desc');
      
      expect(sorted[0].created_at).toBe('2025-01-25');
      expect(sorted[2].created_at).toBe('2025-01-20');
    });
  });
});
