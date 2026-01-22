/**
 * Unit tests for API utilities and helpers
 */
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('axiosClient', () => {
    it('should create axios instance with base URL', () => {
      const { axiosClient } = require('../../api/axiosClient');
      
      expect(axiosClient.defaults.baseURL).toBeDefined();
    });

    it('should add authorization header when token is present', async () => {
      const { axiosClient } = require('../../api/axiosClient');
      const mockToken = 'mock-token-123';
      
      // Mock SecureStore to return token
      const SecureStore = require('expo-secure-store');
      SecureStore.getItemAsync.mockResolvedValue(mockToken);
      
      // The interceptor should add the token
      const config: any = { headers: {} };
      const interceptedConfig = await axiosClient.interceptors.request.handlers[0].fulfilled(config);
      
      expect(interceptedConfig.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('should retry failed requests', async () => {
      const { axiosClient } = require('../../api/axiosClient');
      
      // Should have axios-retry configured
      expect(axiosClient.defaults['axios-retry']).toBeDefined();
    });
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      const { formatCurrency } = require('../../utils/formatters');
      
      expect(formatCurrency(1000)).toBe('R$ 1.000,00');
      expect(formatCurrency(1500.50)).toBe('R$ 1.500,50');
      expect(formatCurrency(0)).toBe('R$ 0,00');
    });

    it('should handle negative values', () => {
      const { formatCurrency } = require('../../utils/formatters');
      
      expect(formatCurrency(-500)).toBe('R$ -500,00');
    });
  });

  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const { formatDate } = require('../../utils/formatters');
      const testDate = new Date('2025-01-22T15:30:00Z');
      
      const formatted = formatDate(testDate);
      
      expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should handle ISO string dates', () => {
      const { formatDate } = require('../../utils/formatters');
      const isoDate = '2025-01-22T15:30:00Z';
      
      const formatted = formatDate(isoDate);
      
      expect(formatted).toBeTruthy();
    });
  });

  describe('validateCPF', () => {
    it('should validate correct CPF', () => {
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
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should invalidate incorrect email', () => {
      const { validateEmail } = require('../../utils/validators');
      
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const { calculateDistance } = require('../../utils/geo');
      
      // São Paulo to Rio de Janeiro (roughly 430km)
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
      
      expect(truncated.length).toBeLessThanOrEqual(23); // 20 + '...'
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
      
      // Call multiple times rapidly
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      // Function should not be called yet
      expect(mockFn).not.toHaveBeenCalled();
      
      // Fast forward time
      jest.advanceTimersByTime(500);
      
      // Function should be called once
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    jest.useRealTimers();
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
    it('should sort items by date', () => {
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
