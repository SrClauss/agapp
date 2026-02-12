/**
 * Unit tests for ProfileCard component
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProfileCard } from '../../components/ProfileCard';

describe('ProfileCard', () => {
  const mockOnChatPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with name only', () => {
      const { getByText } = render(
        <ProfileCard name="John Doe" />
      );
      
      expect(getByText('John Doe')).toBeTruthy();
    });

    it('should render with all props', () => {
      const { getByText } = render(
        <ProfileCard
          name="Jane Smith"
          role="Cliente"
          email="jane@example.com"
          phone="+55 11 98765-4321"
          onChatPress={mockOnChatPress}
        />
      );
      
      expect(getByText('Jane Smith')).toBeTruthy();
      expect(getByText('Cliente')).toBeTruthy();
      expect(getByText('jane@example.com')).toBeTruthy();
      expect(getByText('+55 11 98765-4321')).toBeTruthy();
      expect(getByText('💬 Chat')).toBeTruthy();
    });

    it('should render avatar placeholder with initials when no URL', () => {
      const { getByText } = render(
        <ProfileCard name="Alice Brown" />
      );
      
      expect(getByText('A')).toBeTruthy();
    });

    it('should use first letter for single word name', () => {
      const { getByText } = render(
        <ProfileCard name="Madonna" />
      );
      
      expect(getByText('M')).toBeTruthy();
    });

    it('should capitalize initial', () => {
      const { getByText } = render(
        <ProfileCard name="john" />
      );
      
      expect(getByText('J')).toBeTruthy();
    });
  });

  describe('Optional fields', () => {
    it('should not render role when not provided', () => {
      const { queryByText } = render(
        <ProfileCard name="John Doe" />
      );
      
      expect(queryByText('Cliente')).toBeNull();
      expect(queryByText('Profissional')).toBeNull();
    });

    it('should not render chat button when onChatPress not provided', () => {
      const { queryByText } = render(
        <ProfileCard name="John Doe" />
      );
      
      expect(queryByText('💬 Chat')).toBeNull();
    });
  });

  describe('Chat button interaction', () => {
    it('should call onChatPress when chat button is pressed', () => {
      const { getByText } = render(
        <ProfileCard
          name="John Doe"
          onChatPress={mockOnChatPress}
        />
      );
      
      const chatButton = getByText('💬 Chat');
      fireEvent.press(chatButton);
      
      expect(mockOnChatPress).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple presses', () => {
      const { getByText } = render(
        <ProfileCard
          name="John Doe"
          onChatPress={mockOnChatPress}
        />
      );
      
      const chatButton = getByText('💬 Chat');
      fireEvent.press(chatButton);
      fireEvent.press(chatButton);
      fireEvent.press(chatButton);
      
      expect(mockOnChatPress).toHaveBeenCalledTimes(3);
    });
  });

  describe('Role display', () => {
    it('should render Cliente role', () => {
      const { getByText } = render(
        <ProfileCard name="John Doe" role="Cliente" />
      );
      
      expect(getByText('Cliente')).toBeTruthy();
    });

    it('should render Profissional role', () => {
      const { getByText } = render(
        <ProfileCard name="Jane Smith" role="Profissional" />
      );
      
      expect(getByText('Profissional')).toBeTruthy();
    });
  });
});
