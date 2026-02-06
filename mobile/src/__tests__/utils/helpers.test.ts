/**
 * Unit tests for helper utilities
 */
import { debounce, throttle, sleep, retry } from '../../utils/helpers';

describe('Helper Utilities', () => {
  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      expect(mockFn).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(500);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);
      
      debouncedFn('arg1', 'arg2');
      
      jest.advanceTimersByTime(500);
      
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should reset timer on subsequent calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);
      
      debouncedFn();
      jest.advanceTimersByTime(300);
      
      debouncedFn();
      jest.advanceTimersByTime(300);
      
      expect(mockFn).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(200);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 500);
      
      throttledFn();
      throttledFn();
      throttledFn();
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      jest.advanceTimersByTime(500);
      
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to throttled function', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 500);
      
      throttledFn('arg1', 'arg2');
      
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should allow execution after limit', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 500);
      
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      jest.advanceTimersByTime(600);
      
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve after specified time', async () => {
      const mockFn = jest.fn();
      
      sleep(1000).then(mockFn);
      
      expect(mockFn).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(1000);
      
      await Promise.resolve(); // Flush promises
      
      expect(mockFn).toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    it('should retry failed function', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Failed'));
        }
        return Promise.resolve('Success');
      });
      
      const result = await retry(mockFn, 3, 10); // Use short delay for tests
      
      expect(result).toBe('Success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'));
      
      await expect(retry(mockFn, 2, 10)).rejects.toThrow('Failed');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should succeed on first try', async () => {
      const mockFn = jest.fn().mockResolvedValue('Success');
      
      const result = await retry(mockFn, 3, 10);
      
      expect(result).toBe('Success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
