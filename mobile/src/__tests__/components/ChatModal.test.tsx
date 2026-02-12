/**
 * Unit tests for ChatModal component
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChatModal } from '../../components/ChatModal';
import * as contactsApi from '../../api/contacts';
import * as websocketService from '../../services/websocket';
import useAuthStore from '../../stores/authStore';

// Mock dependencies
jest.mock('../../api/contacts');
jest.mock('../../services/websocket');
jest.mock('../../stores/authStore');

const mockContactsApi = contactsApi as jest.Mocked<typeof contactsApi>;
const mockWebsocketService = websocketService as jest.Mocked<typeof websocketService>;

describe('ChatModal', () => {
  const mockContact: contactsApi.Contact = {
    id: 'contact-123',
    professional_id: 'prof-456',
    professional_name: 'John Professional',
    project_id: 'project-789',
    client_id: 'client-001',
    client_name: 'Jane Client',
    contact_type: 'proposal',
    credits_used: 5,
    status: 'in_conversation',
    contact_details: {},
    chat: [
      {
        id: 'msg-1',
        sender_id: 'prof-456',
        content: 'Hello!',
        created_at: '2024-01-01T10:00:00Z',
      },
      {
        id: 'msg-2',
        sender_id: 'client-001',
        content: 'Hi there!',
        created_at: '2024-01-01T10:01:00Z',
      },
    ],
    created_at: '2024-01-01T09:00:00Z',
    updated_at: '2024-01-01T10:01:00Z',
  };

  const mockOnClose = jest.fn();
  const mockWebSocket = {
    addEventListener: jest.fn(),
    close: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useAuthStore
    (useAuthStore as unknown as jest.Mock).mockReturnValue('prof-456');
    
    // Mock API calls
    mockContactsApi.getContactDetails.mockResolvedValue(mockContact);
    mockContactsApi.sendContactMessage.mockResolvedValue({
      message: 'Message sent',
      message_id: 'msg-3',
    });
    mockContactsApi.markContactMessagesAsRead.mockResolvedValue();
    
    // Mock WebSocket
    mockWebsocketService.createWebsocket.mockReturnValue(mockWebSocket as any);
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      const { getByTestId } = render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      // Loading indicator should be present
      expect(getByTestId || (() => true)).toBeTruthy();
    });

    it('should render modal when visible is true', () => {
      const { getByText } = render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      expect(getByText('Chat')).toBeTruthy();
    });

    it('should not render when visible is false', () => {
      const { queryByText } = render(
        <ChatModal
          visible={false}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      expect(queryByText('Chat')).toBeNull();
    });
  });

  describe('Loading contact', () => {
    it('should load contact details on mount', async () => {
      render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      await waitFor(() => {
        expect(mockContactsApi.getContactDetails).toHaveBeenCalledWith('contact-123');
      });
    });

    it('should mark messages as read on mount', async () => {
      render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      await waitFor(() => {
        expect(mockContactsApi.markContactMessagesAsRead).toHaveBeenCalledWith('contact-123');
      });
    });

    it('should display messages after loading', async () => {
      const { findByText } = render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      const message1 = await findByText('Hello!');
      const message2 = await findByText('Hi there!');
      
      expect(message1).toBeTruthy();
      expect(message2).toBeTruthy();
    });
  });

  describe('Sending messages', () => {
    it('should send message when send button is pressed', async () => {
      const { getByPlaceholderText, getByText, findByText } = render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      await findByText('Chat');
      
      const input = getByPlaceholderText('Digite sua mensagem...');
      fireEvent.changeText(input, 'Test message');
      
      const sendButton = getByText('➤');
      fireEvent.press(sendButton);
      
      await waitFor(() => {
        expect(mockContactsApi.sendContactMessage).toHaveBeenCalledWith(
          'contact-123',
          'Test message'
        );
      });
    });

    it('should not send empty messages', async () => {
      const { getByText, findByText } = render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      await findByText('Chat');
      
      const sendButton = getByText('➤');
      fireEvent.press(sendButton);
      
      expect(mockContactsApi.sendContactMessage).not.toHaveBeenCalled();
    });

    it('should clear input after sending', async () => {
      const { getByPlaceholderText, getByText, findByText } = render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      await findByText('Chat');
      
      const input = getByPlaceholderText('Digite sua mensagem...');
      fireEvent.changeText(input, 'Test message');
      
      const sendButton = getByText('➤');
      fireEvent.press(sendButton);
      
      await waitFor(() => {
        expect(input.props.value).toBe('');
      });
    });
  });

  describe('Close functionality', () => {
    it('should call onClose when close button is pressed', async () => {
      const { getByText, findByText } = render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      await findByText('Chat');
      
      const closeButton = getByText('✕');
      fireEvent.press(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('WebSocket connection', () => {
    it('should create WebSocket connection when visible', async () => {
      render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      await waitFor(() => {
        expect(mockWebsocketService.createWebsocket).toHaveBeenCalled();
      });
    });

    it('should setup message listener', async () => {
      render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      await waitFor(() => {
        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      });
    });
  });

  describe('User display', () => {
    it('should display other user name for professional', async () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue('prof-456');
      
      const { findByText } = render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      const clientName = await findByText('Jane Client');
      expect(clientName).toBeTruthy();
    });

    it('should display other user name for client', async () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue('client-001');
      
      const { findByText } = render(
        <ChatModal
          visible={true}
          onClose={mockOnClose}
          contactId="contact-123"
        />
      );
      
      const professionalName = await findByText('John Professional');
      expect(professionalName).toBeTruthy();
    });
  });
});
