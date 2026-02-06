/**
 * Unit tests for text utilities
 */
import { truncateText, capitalizeFirstLetter, slugify } from '../../utils/text';

describe('Text Utilities', () => {
  describe('truncateText', () => {
    it('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated';
      const truncated = truncateText(longText, 20);
      
      expect(truncated.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(truncated).toContain('...');
      expect(truncated).toContain('This is a very');
    });

    it('should not truncate short text', () => {
      const shortText = 'Short';
      const result = truncateText(shortText, 20);
      
      expect(result).toBe(shortText);
      expect(result).not.toContain('...');
    });

    it('should handle text exactly at max length', () => {
      const text = '12345678901234567890'; // exactly 20 chars
      const result = truncateText(text, 20);
      
      expect(result).toBe(text);
      expect(result).not.toContain('...');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });

  describe('capitalizeFirstLetter', () => {
    it('should capitalize first letter', () => {
      expect(capitalizeFirstLetter('hello')).toBe('Hello');
      expect(capitalizeFirstLetter('world')).toBe('World');
    });

    it('should handle already capitalized text', () => {
      expect(capitalizeFirstLetter('Hello')).toBe('Hello');
    });

    it('should handle single character', () => {
      expect(capitalizeFirstLetter('a')).toBe('A');
    });

    it('should only capitalize first letter', () => {
      expect(capitalizeFirstLetter('hello world')).toBe('Hello world');
    });
  });

  describe('slugify', () => {
    it('should convert text to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('React Native App')).toBe('react-native-app');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello @#$ World!')).toBe('hello-world');
      expect(slugify('Test (123)')).toBe('test-123');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('Hello    World')).toBe('hello-world');
    });

    it('should remove leading and trailing dashes', () => {
      expect(slugify('  Hello World  ')).toBe('hello-world');
      expect(slugify('-Hello-World-')).toBe('hello-world');
    });

    it('should handle underscores', () => {
      expect(slugify('hello_world_test')).toBe('hello-world-test');
    });

    it('should handle empty string', () => {
      expect(slugify('')).toBe('');
    });
  });
});
