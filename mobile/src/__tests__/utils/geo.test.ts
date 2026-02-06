/**
 * Unit tests for geo utilities
 */
import { calculateDistance, formatDistance } from '../../utils/geo';

describe('Geo Utilities', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between São Paulo and Rio de Janeiro', () => {
      const sp = { latitude: -23.5505, longitude: -46.6333 };
      const rio = { latitude: -22.9068, longitude: -43.1729 };
      
      const distance = calculateDistance(sp, rio);
      
      // Distance should be approximately 357 km
      expect(distance).toBeGreaterThan(350);
      expect(distance).toBeLessThan(400);
    });

    it('should return 0 for same location', () => {
      const location = { latitude: -23.5505, longitude: -46.6333 };
      const distance = calculateDistance(location, location);
      
      expect(distance).toBe(0);
    });

    it('should calculate distance between close points', () => {
      const point1 = { latitude: -23.5505, longitude: -46.6333 };
      const point2 = { latitude: -23.5510, longitude: -46.6340 };
      
      const distance = calculateDistance(point1, point2);
      
      // Should be less than 1 km
      expect(distance).toBeLessThan(1);
      expect(distance).toBeGreaterThan(0);
    });

    it('should calculate distance across hemispheres', () => {
      const north = { latitude: 40.7128, longitude: -74.0060 }; // New York
      const south = { latitude: -33.8688, longitude: 151.2093 }; // Sydney
      
      const distance = calculateDistance(north, south);
      
      // Should be > 15000 km
      expect(distance).toBeGreaterThan(15000);
    });
  });

  describe('formatDistance', () => {
    it('should format distances less than 1 km in meters', () => {
      expect(formatDistance(0.5)).toBe('500m');
      expect(formatDistance(0.123)).toBe('123m');
      expect(formatDistance(0.999)).toBe('999m');
    });

    it('should format distances >= 1 km in kilometers', () => {
      expect(formatDistance(1)).toBe('1.0km');
      expect(formatDistance(5.5)).toBe('5.5km');
      expect(formatDistance(100)).toBe('100.0km');
      expect(formatDistance(1234.567)).toBe('1234.6km');
    });

    it('should handle edge cases', () => {
      expect(formatDistance(0)).toBe('0m');
      expect(formatDistance(0.001)).toBe('1m');
    });
  });
});
