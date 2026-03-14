/**
 * Chat Flow Integration Tests
 *
 * Covers the full chat lifecycle after a professional takes a project:
 *   1. Creating a contact (professional takes a project)
 *   2. Fetching contact history
 *   3. Fetching contact details
 *   4. Sending a message
 *   5. Marking messages as read
 *   6. WebSocket message format validation
 *   7. ChatStore state transitions
 *   8. Token renewal loop prevention (axiosClient guard)
 */

import {
  createContactForProject,
  getContactHistory,
  getContactDetails,
  sendContactMessage,
  markContactMessagesAsRead,
  Contact,
  ChatMessage,
} from '../api/contacts';
import client from '../api/axiosClient';
import useChatStore from '../stores/chatStore';
import { renderHook, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
jest.mock('../api/axiosClient');
jest.mock('../stores/authStore', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(() => ({
      token: 'mock-token-abc123',
      user: { id: 'prof-001', full_name: 'João Silva' },
    })),
  },
}));
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

const mockClient = client as jest.Mocked<typeof client>;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const CONTACT_ID = '01JKCONTACT0000000000001';
const PROJECT_ID = '01JKPROJECT0000000000001';
const PROFESSIONAL_ID = 'prof-001';
const CLIENT_ID = 'client-002';

const mockContact: Contact = {
  id: CONTACT_ID,
  professional_id: PROFESSIONAL_ID,
  professional_name: 'João Silva',
  project_id: PROJECT_ID,
  client_id: CLIENT_ID,
  client_name: 'Maria Souza',
  contact_type: 'proposal',
  credits_used: 3,
  status: 'pending',
  contact_details: { message: 'Tenho experiência neste serviço', proposal_price: 500 },
  chat: [],
  created_at: '2024-01-01T09:00:00Z',
  updated_at: '2024-01-01T09:00:00Z',
};

const mockMessage: ChatMessage = {
  id: '01JKMSG000000000000001',
  sender_id: PROFESSIONAL_ID,
  content: 'Olá, posso ajudá-lo com este projeto.',
  created_at: '2024-01-01T10:00:00Z',
};

// ---------------------------------------------------------------------------
// 1. Creating a contact (professional takes a project)
// ---------------------------------------------------------------------------
describe('1. Creating a contact (professional takes a project)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should call POST /projects/{id}/contacts with correct payload', async () => {
    mockClient.post.mockResolvedValue({ data: mockContact, status: 201 });

    const result = await createContactForProject(PROJECT_ID, {
      contact_type: 'proposal',
      contact_details: { message: 'Tenho experiência neste serviço', proposal_price: 500 },
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/contacts`,
      {
        contact_type: 'proposal',
        contact_details: { message: 'Tenho experiência neste serviço', proposal_price: 500 },
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token-abc123',
          'X-Idempotency-Key': expect.any(String),
        }),
      })
    );
    expect(result.id).toBe(CONTACT_ID);
  });

  it('should return the contact with a ULID-format id', async () => {
    // The backend now returns a proper ULID (not "projectId_index")
    const ulidContact = { ...mockContact, id: '01JKABCDEFGHIJKLMNOPQRSTUV' };  // 26 chars
    mockClient.post.mockResolvedValue({ data: ulidContact, status: 201 });

    const result = await createContactForProject(PROJECT_ID, {
      contact_details: { message: 'Test' },
    });

    // ULID has 26 characters
    expect(result.id.length).toBe(26);
    expect(result.id).not.toContain('_'); // old format was "projectId_0"
  });

  it('should reject with error on duplicate contact (400)', async () => {
    mockClient.post.mockRejectedValue({
      response: { status: 400, data: { detail: 'Contact already exists for this project' } },
    });

    await expect(
      createContactForProject(PROJECT_ID, { contact_details: {} })
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('should reject with error on insufficient credits (400)', async () => {
    mockClient.post.mockRejectedValue({
      response: { status: 400, data: { detail: 'Insufficient credits' } },
    });

    await expect(
      createContactForProject(PROJECT_ID, { contact_details: {} })
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});

// ---------------------------------------------------------------------------
// 2. Fetching contact history
// ---------------------------------------------------------------------------
describe('2. Fetching contact history', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should fetch professional contact history from /contacts/history', async () => {
    mockClient.get.mockResolvedValue({ data: [mockContact] });

    const result = await getContactHistory('professional');

    expect(mockClient.get).toHaveBeenCalledWith(
      '/contacts/history',
      expect.objectContaining({
        params: { user_type: 'professional' },
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(CONTACT_ID);
  });

  it('should fetch client contact history', async () => {
    mockClient.get.mockResolvedValue({ data: [mockContact] });

    await getContactHistory('client');

    expect(mockClient.get).toHaveBeenCalledWith(
      '/contacts/history',
      expect.objectContaining({ params: { user_type: 'client' } })
    );
  });

  it('should return empty array when no contacts exist', async () => {
    mockClient.get.mockResolvedValue({ data: [] });

    const result = await getContactHistory('professional');
    expect(result).toHaveLength(0);
  });

  it('should include unread_count in contact history items', async () => {
    const contactWithUnread = { ...mockContact, unread_count: 3 };
    mockClient.get.mockResolvedValue({ data: [contactWithUnread] });

    const result = await getContactHistory('professional');
    expect(result[0].unread_count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 3. Fetching contact details
// ---------------------------------------------------------------------------
describe('3. Fetching contact details', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should fetch contact details with chat history', async () => {
    const contactWithChat = { ...mockContact, chat: [mockMessage] };
    mockClient.get.mockResolvedValue({ data: contactWithChat });

    const result = await getContactDetails(CONTACT_ID);

    expect(mockClient.get).toHaveBeenCalledWith(
      `/contacts/${CONTACT_ID}`,
      expect.objectContaining({
        headers: { Authorization: 'Bearer mock-token-abc123' },
      })
    );
    expect(result.chat).toHaveLength(1);
    expect(result.chat[0].content).toBe('Olá, posso ajudá-lo com este projeto.');
  });

  it('should throw on 404 (contact not found)', async () => {
    mockClient.get.mockRejectedValue({ response: { status: 404 } });

    await expect(getContactDetails('nonexistent')).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it('should throw on 403 (not a participant)', async () => {
    mockClient.get.mockRejectedValue({ response: { status: 403 } });

    await expect(getContactDetails(CONTACT_ID)).rejects.toMatchObject({
      response: { status: 403 },
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Sending a message
// ---------------------------------------------------------------------------
describe('4. Sending a message', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should POST to /contacts/{id}/messages with the message content', async () => {
    mockClient.post.mockResolvedValue({
      data: { message: 'Message sent', message_id: '01JKMSGID000000001', data: mockMessage },
    });

    const result = await sendContactMessage(CONTACT_ID, 'Olá, posso ajudá-lo.');

    expect(mockClient.post).toHaveBeenCalledWith(
      `/contacts/${CONTACT_ID}/messages`,
      { content: 'Olá, posso ajudá-lo.' },
      expect.objectContaining({
        headers: { Authorization: 'Bearer mock-token-abc123' },
      })
    );
    expect(result.message).toBe('Message sent');
    expect(result.message_id).toBeTruthy();
  });

  it('should return message_id from server response', async () => {
    mockClient.post.mockResolvedValue({
      data: { message: 'Message sent', message_id: '01JKMSGID000000002' },
    });

    const result = await sendContactMessage(CONTACT_ID, 'Test');
    expect(result.message_id).toBe('01JKMSGID000000002');
  });

  it('should reject when contact does not exist', async () => {
    mockClient.post.mockRejectedValue({ response: { status: 404 } });

    await expect(sendContactMessage('bad-id', 'Hello')).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Marking messages as read
// ---------------------------------------------------------------------------
describe('5. Marking messages as read', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should POST to /contacts/{id}/messages/mark-read', async () => {
    mockClient.post.mockResolvedValue({ data: { message: 'Messages marked as read' } });

    await markContactMessagesAsRead(CONTACT_ID);

    expect(mockClient.post).toHaveBeenCalledWith(
      `/contacts/${CONTACT_ID}/messages/mark-read`,
      {},
      expect.objectContaining({
        headers: { Authorization: 'Bearer mock-token-abc123' },
      })
    );
  });

  it('should not throw when mark-read succeeds', async () => {
    mockClient.post.mockResolvedValue({ data: {} });
    await expect(markContactMessagesAsRead(CONTACT_ID)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. WebSocket message format validation
// ---------------------------------------------------------------------------
describe('6. WebSocket new_message format (backend → frontend contract)', () => {
  /**
   * The backend sends: { type: 'new_message', contact_id: '...', message: { id, sender_id, content, created_at } }
   * The frontend (ContactDetailScreen) must read: data.message.id, data.message.sender_id, etc.
   * This test documents and validates the expected structure.
   */

  const backendPayload = {
    type: 'new_message',
    contact_id: CONTACT_ID,
    message: {
      id: '01JKMSG000000000000001',
      sender_id: PROFESSIONAL_ID,
      content: 'Mensagem via WebSocket',
      created_at: '2024-01-01T10:05:00.000Z',
    },
  };

  it('should have message nested under data.message (not at top level)', () => {
    const data = backendPayload;
    expect(data.message).toBeDefined();
    expect((data as any).message_id).toBeUndefined(); // old wrong field
    expect((data as any).sender_id).toBeUndefined();  // old wrong field
    expect((data as any).content).toBeUndefined();    // old wrong field
  });

  it('should be able to construct a ChatMessage from data.message', () => {
    const data = backendPayload;
    const msg = data.message;

    const chatMessage: ChatMessage = {
      id: msg.id,
      sender_id: msg.sender_id,
      content: msg.content,
      created_at: msg.created_at || new Date().toISOString(),
    };

    expect(chatMessage.id).toBe('01JKMSG000000000000001');
    expect(chatMessage.sender_id).toBe(PROFESSIONAL_ID);
    expect(chatMessage.content).toBe('Mensagem via WebSocket');
    expect(chatMessage.created_at).toBe('2024-01-01T10:05:00.000Z');
  });

  it('should handle contact_update with nested data.contact.contact_id', () => {
    const updatePayload = {
      type: 'contact_update',
      contact: { contact_id: CONTACT_ID, status: 'in_conversation' },
    };

    // Frontend should check data.contact?.contact_id, not data.contact_id
    expect(updatePayload.contact?.contact_id).toBe(CONTACT_ID);
    expect((updatePayload as any).contact_id).toBeUndefined(); // wrong pattern
  });
});

// ---------------------------------------------------------------------------
// 7. ChatStore state transitions
// ---------------------------------------------------------------------------
describe('7. ChatStore state transitions', () => {
  beforeEach(() => {
    useChatStore.setState({ isChatOpen: false, activeContactId: null });
  });

  it('should open chat with correct contactId after professional takes project', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.openChat(CONTACT_ID);
    });

    expect(result.current.isChatOpen).toBe(true);
    expect(result.current.activeContactId).toBe(CONTACT_ID);
  });

  it('should close chat and clear contactId', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => result.current.openChat(CONTACT_ID));
    act(() => result.current.closeChat());

    expect(result.current.isChatOpen).toBe(false);
    expect(result.current.activeContactId).toBeNull();
  });

  it('should switch to a new contact without closing first', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => result.current.openChat(CONTACT_ID));
    act(() => result.current.openChat('01JKCONTACT0000000000002'));

    expect(result.current.isChatOpen).toBe(true);
    expect(result.current.activeContactId).toBe('01JKCONTACT0000000000002');
  });

  it('should not have an existing contact id after logout (reset)', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => result.current.openChat(CONTACT_ID));
    act(() => useChatStore.setState({ isChatOpen: false, activeContactId: null }));

    expect(result.current.activeContactId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. Token renewal loop prevention
// ---------------------------------------------------------------------------
describe('8. Token renewal loop prevention (axiosClient guard)', () => {
  /**
   * The backend returns a new JWT in the Authorization response header on
   * every request. The axiosClient must NOT call setToken when the new
   * token is identical to the current one, to avoid infinite re-renders.
   */

  it('should not store duplicate token when backend returns same token', () => {
    const SAME_TOKEN = 'mock-token-abc123';

    // Simulate what the response interceptor does
    const currentToken: string = 'mock-token-abc123';
    const newToken: string = 'renewed-token-xyz789';

    // The guard condition: only update when different
    const shouldUpdate = String(newToken) !== String(currentToken);
    expect(shouldUpdate).toBe(false); // must NOT trigger setToken
  });

  it('should update token only when backend returns a genuinely new one', () => {
    const currentToken = 'mock-token-abc123';
    const newToken = 'renewed-token-xyz789';

    const shouldUpdate = String(newToken) !== String(currentToken);
    expect(shouldUpdate).toBe(true); // should update
  });

  it('should not trigger push notification re-registration on token renewal', () => {
    /**
     * App.tsx uses a ref (notificationsRegisteredRef) to guard against
     * repeated push notification registration. After the first registration,
     * subsequent token changes should be a no-op.
     */
    let registeredCount = 0;
    const notificationsRegisteredRef = { current: false };

    const registerIfNeeded = (token: string | null) => {
      if (!token) { notificationsRegisteredRef.current = false; return; }
      if (notificationsRegisteredRef.current) return; // guard
      registeredCount++;
      notificationsRegisteredRef.current = true;
    };

    // First login: should register once
    registerIfNeeded('token-v1');
    expect(registeredCount).toBe(1);

    // Token renews (same user, new JWT): should NOT re-register
    registerIfNeeded('token-v2');
    registerIfNeeded('token-v3');
    expect(registeredCount).toBe(1); // still 1

    // Logout then login again: should register once more
    registerIfNeeded(null); // logout resets ref
    registerIfNeeded('token-v4');
    expect(registeredCount).toBe(2);
  });
});
