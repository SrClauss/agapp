/**
 * Unit tests for array utilities
 */
import { groupBy, sortByDate, uniqueBy, chunk } from '../../utils/array';

describe('Array Utilities', () => {
  describe('groupBy', () => {
    it('should group array by key', () => {
      const items = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
        { category: 'C', value: 4 },
        { category: 'B', value: 5 },
      ];
      
      const grouped = groupBy(items, 'category');
      
      expect(grouped.A).toHaveLength(2);
      expect(grouped.B).toHaveLength(2);
      expect(grouped.C).toHaveLength(1);
      expect(grouped.A[0].value).toBe(1);
      expect(grouped.A[1].value).toBe(3);
    });

    it('should handle empty array', () => {
      const grouped = groupBy([], 'category');
      expect(grouped).toEqual({});
    });

    it('should group by numeric key', () => {
      const items = [
        { status: 1, name: 'A' },
        { status: 2, name: 'B' },
        { status: 1, name: 'C' },
      ];
      
      const grouped = groupBy(items, 'status');
      
      expect(grouped['1']).toHaveLength(2);
      expect(grouped['2']).toHaveLength(1);
    });
  });

  describe('sortByDate', () => {
    it('should sort items by date descending', () => {
      const items = [
        { created_at: '2025-01-22' },
        { created_at: '2025-01-20' },
        { created_at: '2025-01-25' },
      ];
      
      const sorted = sortByDate(items, 'created_at', 'desc');
      
      expect(sorted[0].created_at).toBe('2025-01-25');
      expect(sorted[1].created_at).toBe('2025-01-22');
      expect(sorted[2].created_at).toBe('2025-01-20');
    });

    it('should sort items by date ascending', () => {
      const items = [
        { created_at: '2025-01-22' },
        { created_at: '2025-01-20' },
        { created_at: '2025-01-25' },
      ];
      
      const sorted = sortByDate(items, 'created_at', 'asc');
      
      expect(sorted[0].created_at).toBe('2025-01-20');
      expect(sorted[1].created_at).toBe('2025-01-22');
      expect(sorted[2].created_at).toBe('2025-01-25');
    });

    it('should default to descending order', () => {
      const items = [
        { created_at: '2025-01-22' },
        { created_at: '2025-01-25' },
      ];
      
      const sorted = sortByDate(items, 'created_at');
      
      expect(sorted[0].created_at).toBe('2025-01-25');
    });

    it('should not mutate original array', () => {
      const items = [
        { created_at: '2025-01-22' },
        { created_at: '2025-01-20' },
      ];
      
      const sorted = sortByDate(items, 'created_at');
      
      expect(items[0].created_at).toBe('2025-01-22');
      expect(sorted[0].created_at).toBe('2025-01-22');
    });
  });

  describe('uniqueBy', () => {
    it('should remove duplicates by key', () => {
      const items = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'C' },
        { id: 3, name: 'D' },
      ];
      
      const unique = uniqueBy(items, 'id');
      
      expect(unique).toHaveLength(3);
      expect(unique[0].id).toBe(1);
      expect(unique[1].id).toBe(2);
      expect(unique[2].id).toBe(3);
    });

    it('should keep first occurrence', () => {
      const items = [
        { id: 1, name: 'First' },
        { id: 1, name: 'Second' },
      ];
      
      const unique = uniqueBy(items, 'id');
      
      expect(unique).toHaveLength(1);
      expect(unique[0].name).toBe('First');
    });

    it('should handle empty array', () => {
      const unique = uniqueBy([], 'id');
      expect(unique).toEqual([]);
    });
  });

  describe('chunk', () => {
    it('should chunk array into specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const chunks = chunk(array, 3);
      
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7, 8, 9]);
    });

    it('should handle array not divisible by chunk size', () => {
      const array = [1, 2, 3, 4, 5];
      const chunks = chunk(array, 2);
      
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual([1, 2]);
      expect(chunks[1]).toEqual([3, 4]);
      expect(chunks[2]).toEqual([5]);
    });

    it('should handle chunk size larger than array', () => {
      const array = [1, 2, 3];
      const chunks = chunk(array, 10);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual([1, 2, 3]);
    });

    it('should handle empty array', () => {
      const chunks = chunk([], 3);
      expect(chunks).toEqual([]);
    });
  });
});
