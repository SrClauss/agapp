/**
 * Unit tests for validator functions
 */
import {
  validateCPF,
  validateEmail,
  validatePhone,
  validatePassword,
} from '../../utils/validators';

describe('Validators', () => {
  describe('validateCPF', () => {
    it('should validate correct CPF formats', () => {
      expect(validateCPF('12345678900')).toBe(true);
      expect(validateCPF('123.456.789-00')).toBe(true);
      expect(validateCPF('111.222.333-44')).toBe(true);
    });

    it('should reject invalid CPFs', () => {
      expect(validateCPF('')).toBe(false);
      expect(validateCPF('123')).toBe(false);
      expect(validateCPF('00000000000')).toBe(false);
      expect(validateCPF('11111111111')).toBe(false);
      expect(validateCPF('12345')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(validateCPF(null as any)).toBe(false);
      expect(validateCPF(undefined as any)).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
      expect(validateEmail('user123@test.io')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('user@domain')).toBe(false);
      expect(validateEmail('user name@domain.com')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(validateEmail(null as any)).toBe(false);
      expect(validateEmail(undefined as any)).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone numbers', () => {
      expect(validatePhone('11987654321')).toBe(true); // 11 digits
      expect(validatePhone('1198765432')).toBe(true); // 10 digits
      expect(validatePhone('(11) 98765-4321')).toBe(true); // formatted
      expect(validatePhone('(11) 9876-5432')).toBe(true); // formatted
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('')).toBe(false);
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('123456789')).toBe(false); // 9 digits
      expect(validatePhone('123456789012')).toBe(false); // 12 digits
    });

    it('should handle null/undefined', () => {
      expect(validatePhone(null as any)).toBe(false);
      expect(validatePhone(undefined as any)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate passwords with minimum length', () => {
      expect(validatePassword('password123')).toBe(true);
      expect(validatePassword('12345678')).toBe(true);
      expect(validatePassword('abcdefgh')).toBe(true);
    });

    it('should reject short passwords', () => {
      expect(validatePassword('1234567')).toBe(false);
      expect(validatePassword('abc')).toBe(false);
      expect(validatePassword('')).toBe(false);
    });
  });
});
