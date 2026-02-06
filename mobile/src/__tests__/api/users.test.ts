/**
 * Unit tests for users API
 */
import {
  getProfessionalSettings,
  updateProfessionalSettings,
  getUserPublic,
} from '../../api/users';
import client from '../../api/axiosClient';

jest.mock('../../api/axiosClient');

const mockClient = client as jest.Mocked<typeof client>;

describe('Users API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfessionalSettings', () => {
    it('should fetch professional settings', async () => {
      const mockSettings = {
        establishment_name: 'My Business',
        service_radius_km: 50,
        accepts_remote: true,
        skills: ['carpentry', 'plumbing'],
      };

      mockClient.get.mockResolvedValue({ data: mockSettings });

      const result = await getProfessionalSettings('token-123');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/users/me/professional-settings',
        { headers: { Authorization: 'Bearer token-123' } }
      );
      expect(result).toEqual(mockSettings);
    });
  });

  describe('updateProfessionalSettings', () => {
    it('should update professional settings', async () => {
      const mockResponse = { success: true };
      const settingsUpdate = {
        establishment_name: 'Updated Business',
        service_radius_km: 75,
      };

      mockClient.put.mockResolvedValue({ data: mockResponse });

      const result = await updateProfessionalSettings('token-123', settingsUpdate);

      expect(mockClient.put).toHaveBeenCalledWith(
        '/users/me/professional-settings',
        settingsUpdate,
        { headers: { Authorization: 'Bearer token-123' } }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle partial updates', async () => {
      const mockResponse = { success: true };
      const partialUpdate = {
        accepts_remote: false,
      };

      mockClient.put.mockResolvedValue({ data: mockResponse });

      await updateProfessionalSettings('token-123', partialUpdate);

      expect(mockClient.put).toHaveBeenCalledWith(
        '/users/me/professional-settings',
        partialUpdate,
        { headers: { Authorization: 'Bearer token-123' } }
      );
    });
  });

  describe('getUserPublic', () => {
    it('should fetch public user data', async () => {
      const mockUser = {
        id: 'user-123',
        full_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        phone: '11987654321',
      };

      mockClient.get.mockResolvedValue({ data: mockUser });

      const result = await getUserPublic('user-123');

      expect(mockClient.get).toHaveBeenCalledWith('/users/public/user-123');
      expect(result).toEqual(mockUser);
    });

    it('should handle user without optional fields', async () => {
      const mockUser = {
        id: 'user-456',
      };

      mockClient.get.mockResolvedValue({ data: mockUser });

      const result = await getUserPublic('user-456');

      expect(result.id).toBe('user-456');
      expect(result.full_name).toBeUndefined();
      expect(result.avatar_url).toBeUndefined();
    });
  });
});
