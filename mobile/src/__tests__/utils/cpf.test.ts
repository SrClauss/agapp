/**
 * Unit tests for CPF validation with full algorithm
 */
import { onlyDigits, isValidCPF } from '../../utils/cpf';

describe('CPF Utilities', () => {
  describe('onlyDigits', () => {
    it('should extract only digits from string', () => {
      expect(onlyDigits('123.456.789-00')).toBe('12345678900');
      expect(onlyDigits('(11) 98765-4321')).toBe('11987654321');
      expect(onlyDigits('abc123def456')).toBe('123456');
    });

    it('should handle empty string', () => {
      expect(onlyDigits('')).toBe('');
    });

    it('should handle string with no digits', () => {
      expect(onlyDigits('abcdef')).toBe('');
    });
  });

  describe('isValidCPF', () => {
    it('should validate correct CPFs', () => {
      // Valid CPFs with correct check digits
      expect(isValidCPF('11144477735')).toBe(true);
      expect(isValidCPF('111.444.777-35')).toBe(true);
    });

    it('should reject invalid CPFs', () => {
      expect(isValidCPF('00000000000')).toBe(false);
      expect(isValidCPF('11111111111')).toBe(false);
      expect(isValidCPF('22222222222')).toBe(false);
      expect(isValidCPF('12345678900')).toBe(false); // Invalid check digits
    });

    it('should reject CPFs with wrong length', () => {
      expect(isValidCPF('123')).toBe(false);
      expect(isValidCPF('123456789')).toBe(false);
      expect(isValidCPF('123456789012')).toBe(false);
    });

    it('should handle null/undefined/empty', () => {
      expect(isValidCPF(null)).toBe(false);
      expect(isValidCPF(undefined)).toBe(false);
      expect(isValidCPF('')).toBe(false);
    });
  });
});
