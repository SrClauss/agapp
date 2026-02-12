/**
 * Unit tests for ProjectContactsList component
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProjectContactsList from '../../components/ProjectContactsList';
import { ContactSummary } from '../../api/projects';
import useChatStore from '../../stores/chatStore';

// Mock dependencies
jest.mock('../../stores/chatStore');

describe('ProjectContactsList', () => {
  const mockContacts: ContactSummary[] = [
    {
      id: 'contact-1',
      professional_id: 'prof-1',
      professional_name: 'John Doe',
      professional_avatar: 'https://example.com/avatar1.jpg',
      status: 'pending',
      created_at: '2024-01-01T10:00:00Z',
      unread_count: 0,
      contact_details: {},
    },
    {
      id: 'contact-2',
      professional_id: 'prof-2',
      professional_name: 'Jane Smith',
      professional_avatar: undefined,
      status: 'in_conversation',
      created_at: '2024-01-02T11:00:00Z',
      unread_count: 3,
      last_message: {
        id: 'msg-1',
        sender_id: 'prof-2',
        content: 'Hello there!',
        created_at: '2024-01-02T11:30:00Z',
      },
      contact_details: {
        proposal_price: 1500.00,
      },
    },
  ];

  const mockOpenChat = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useChatStore as unknown as jest.Mock).mockReturnValue({
      openChat: mockOpenChat,
    });
  });

  describe('Rendering', () => {
    it('should render list of contacts', () => {
      const { getByText } = render(
        <ProjectContactsList contacts={mockContacts} />
      );
      
      expect(getByText('John Doe')).toBeTruthy();
      expect(getByText('Jane Smith')).toBeTruthy();
    });

    it('should render empty state when no contacts', () => {
      const { getByText } = render(
        <ProjectContactsList contacts={[]} />
      );
      
      expect(getByText('Nenhum profissional entrou em contato ainda.')).toBeTruthy();
    });

    it('should display unread count badge', () => {
      const { getByText } = render(
        <ProjectContactsList contacts={mockContacts} />
      );
      
      expect(getByText('3')).toBeTruthy();
    });

    it('should display last message', () => {
      const { getByText } = render(
        <ProjectContactsList contacts={mockContacts} />
      );
      
      expect(getByText('Hello there!')).toBeTruthy();
    });

    it('should display proposal price', () => {
      const { getByText } = render(
        <ProjectContactsList contacts={mockContacts} />
      );
      
      expect(getByText('Proposta: R$ 1500.00')).toBeTruthy();
    });

    it('should display status label', () => {
      const { getByText } = render(
        <ProjectContactsList contacts={mockContacts} />
      );
      
      expect(getByText('Aguardando resposta')).toBeTruthy();
      expect(getByText('Em conversa')).toBeTruthy();
    });
  });

  describe('Contact interaction', () => {
    it('should open chat when contact is pressed', () => {
      const { getByText } = render(
        <ProjectContactsList contacts={mockContacts} />
      );
      
      const contact = getByText('John Doe');
      fireEvent.press(contact);
      
      expect(mockOpenChat).toHaveBeenCalledWith('contact-1');
    });

    it('should use custom onContactPress if provided', () => {
      const mockCustomHandler = jest.fn();
      
      const { getByText } = render(
        <ProjectContactsList 
          contacts={mockContacts}
          onContactPress={mockCustomHandler}
        />
      );
      
      const contact = getByText('Jane Smith');
      fireEvent.press(contact);
      
      expect(mockCustomHandler).toHaveBeenCalledWith('contact-2');
      expect(mockOpenChat).not.toHaveBeenCalled();
    });
  });

  describe('Status labels', () => {
    const statusTestCases = [
      { status: 'pending', label: 'Aguardando resposta' },
      { status: 'in_conversation', label: 'Em conversa' },
      { status: 'accepted', label: 'Aceito' },
      { status: 'rejected', label: 'Rejeitado' },
      { status: 'completed', label: 'Concluído' },
    ];

    statusTestCases.forEach(({ status, label }) => {
      it(`should display correct label for ${status} status`, () => {
        const contacts: ContactSummary[] = [{
          id: 'contact-test',
          professional_id: 'prof-test',
          professional_name: 'Test Professional',
          status,
          created_at: '2024-01-01T10:00:00Z',
          unread_count: 0,
          contact_details: {},
        }];
        
        const { getByText } = render(
          <ProjectContactsList contacts={contacts} />
        );
        
        expect(getByText(label)).toBeTruthy();
      });
    });
  });

  describe('Avatar rendering', () => {
    it('should render avatar image when URL provided', () => {
      const { UNSAFE_getAllByType } = render(
        <ProjectContactsList contacts={mockContacts} />
      );
      
      const images = UNSAFE_getAllByType('Image');
      expect(images.length).toBeGreaterThan(0);
    });

    it('should render avatar icon when no URL', () => {
      const contactsWithoutAvatar: ContactSummary[] = [{
        id: 'contact-no-avatar',
        professional_id: 'prof-no-avatar',
        professional_name: 'No Avatar Professional',
        professional_avatar: undefined,
        status: 'pending',
        created_at: '2024-01-01T10:00:00Z',
        unread_count: 0,
        contact_details: {},
      }];
      
      const { getByText } = render(
        <ProjectContactsList contacts={contactsWithoutAvatar} />
      );
      
      expect(getByText('No Avatar Professional')).toBeTruthy();
    });
  });

  describe('Date formatting', () => {
    it('should display relative time for created_at', () => {
      const { getAllByText } = render(
        <ProjectContactsList contacts={mockContacts} />
      );
      
      // Should display something like "há X dias/horas"
      const timeElements = getAllByText(/há/i);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });
});
