import { getContactCostPreview, createContactForProject, getContactDetails, sendContactMessage } from '../../api/contacts';
import client from '../../api/axiosClient';

jest.mock('../../api/axiosClient');
jest.mock('../../stores/authStore', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(() => ({ token: 'mock-token', user: { id: 'user-123', credits: 10 } })),
  },
}));

const mockClient = client as jest.Mocked<typeof client>;

describe('Contacts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getContactCostPreview', () => {
    it('should fetch cost preview for a project', async () => {
      const mockPreview = {
        credits_cost: 3,
        reason: 'new_project',
        current_balance: 10,
        can_afford: true,
      };

      mockClient.get.mockResolvedValue({ data: mockPreview });

      const result = await getContactCostPreview('project-123');

      expect(mockClient.get).toHaveBeenCalledWith(
        '/contacts/project-123/cost-preview',
        { headers: { Authorization: 'Bearer mock-token' } }
      );
      expect(result).toEqual(mockPreview);
    });

    it('should handle insufficient credits', async () => {
      const mockPreview = {
        credits_cost: 3,
        reason: 'new_project',
        current_balance: 1,
        can_afford: false,
      };

      mockClient.get.mockResolvedValue({ data: mockPreview });

      const result = await getContactCostPreview('project-123');

      expect(result.can_afford).toBe(false);
      expect(result.current_balance).toBeLessThan(result.credits_cost);
    });

    it('should handle existing contact', async () => {
      const mockPreview = {
        credits_cost: 0,
        reason: 'contact_already_exists',
        current_balance: 10,
        can_afford: true,
        message: 'You already have a contact with this project',
      };

      mockClient.get.mockResolvedValue({ data: mockPreview });

      const result = await getContactCostPreview('project-123');

      expect(result.credits_cost).toBe(0);
      expect(result.reason).toBe('contact_already_exists');
    });
  });

  describe('createContactForProject', () => {
    it('should create contact successfully', async () => {
      const mockContact = {
        id: 'contact-123',
        professional_id: 'user-123',
        project_id: 'project-123',
        client_id: 'client-456',
        contact_type: 'proposal',
        credits_used: 3,
        status: 'pending',
        contact_details: { message: 'Hello' },
        chat: [],
        created_at: '2026-02-06T00:00:00Z',
        updated_at: '2026-02-06T00:00:00Z',
      };

      mockClient.post.mockResolvedValue({ data: mockContact });

      const result = await createContactForProject('project-123', {
        contact_type: 'proposal',
        contact_details: { message: 'Hello' },
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/contacts/project-123',
        { contact_type: 'proposal', contact_details: { message: 'Hello' } },
        { headers: { Authorization: 'Bearer mock-token' } }
      );
      expect(result).toEqual(mockContact);
      expect(result.credits_used).toBe(3);
    });

    it('should throw error when contact already exists', async () => {
      mockClient.post.mockRejectedValue({
        response: {
          status: 400,
          data: { detail: 'Contact already exists for this project' },
        },
      });

      await expect(
        createContactForProject('project-123', {
          contact_type: 'proposal',
          contact_details: { message: 'Hello' },
        })
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: { detail: 'Contact already exists for this project' },
        },
      });
    });

    it('should throw error when insufficient credits', async () => {
      mockClient.post.mockRejectedValue({
        response: {
          status: 400,
          data: { detail: 'Insufficient credits' },
        },
      });

      await expect(
        createContactForProject('project-123', {
          contact_type: 'proposal',
          contact_details: { message: 'Hello' },
        })
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: { detail: 'Insufficient credits' },
        },
      });
    });
  });

  describe('sendContactMessage', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        message: 'Message sent',
        message_id: 'msg-123',
      };

      mockClient.post.mockResolvedValue({ data: mockResponse });

      const result = await sendContactMessage('contact-123', 'Hello there');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/contacts/contact-123/messages',
        { content: 'Hello there' },
        { headers: { Authorization: 'Bearer mock-token' } }
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
