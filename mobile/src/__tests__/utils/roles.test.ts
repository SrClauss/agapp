/**
 * Unit tests for role routing utilities
 */
import { getRouteForRoles } from '../../utils/roles';

describe('Role Utilities', () => {
  describe('getRouteForRoles', () => {
    it('should route to active role screen when provided', () => {
      expect(getRouteForRoles(['client', 'professional'], 'client')).toBe('WelcomeCustomer');
      expect(getRouteForRoles(['client', 'professional'], 'professional')).toBe('WelcomeProfessional');
      expect(getRouteForRoles(['client'], 'client')).toBe('WelcomeCustomer');
    });

    it('should show profile selection for users with both roles', () => {
      expect(getRouteForRoles(['client', 'professional'])).toBe('ProfileSelection');
    });

    it('should route professionals to professional screen', () => {
      expect(getRouteForRoles(['professional'])).toBe('WelcomeProfessional');
    });

    it('should route clients to customer screen', () => {
      expect(getRouteForRoles(['client'])).toBe('WelcomeCustomer');
    });

    it('should show profile selection for users with no roles', () => {
      expect(getRouteForRoles([])).toBe('ProfileSelection');
      expect(getRouteForRoles(undefined)).toBe('ProfileSelection');
      expect(getRouteForRoles(null)).toBe('ProfileSelection');
    });

    it('should prioritize activeRole over roles array', () => {
      expect(getRouteForRoles(['professional'], 'client')).toBe('WelcomeCustomer');
      expect(getRouteForRoles([], 'professional')).toBe('WelcomeProfessional');
    });
  });
});
