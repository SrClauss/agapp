import React from 'react';
// Ensure React Native dev flag exists in test environment
(global as any).__DEV__ = true;

// Mock react-native core to avoid native module issues in jest
jest.mock('react-native', () => {
  return {
    View: 'View',
    Text: 'Text',
    StyleSheet: { create: (s: any) => s },
    ActivityIndicator: 'ActivityIndicator',
    TouchableOpacity: 'TouchableOpacity',
    Dimensions: { get: () => ({ width: 400, height: 800 }), set: () => {}, screen: { width: 400, height: 800 }, window: { width: 400, height: 800 } },
  };
});

import { render, waitFor } from '@testing-library/react-native';
import ProfessionalStatsCard from '../src/components/ProfessionalStatsCard';

// Mock the API call
jest.mock('../src/api/professional', () => ({
  getProfessionalStats: jest.fn(async () => ({
    active_subscriptions: 1,
    credits_available: 999,
    contacts_received: 2,
    projects_completed: 3,
  })),
}));

// Mock react-native-paper to simple renderable components
jest.mock('react-native-paper', () => {
  const React = require('react');
  return {
    Card: ({ children }: any) => React.createElement('View', null, children),
    Text: ({ children }: any) => React.createElement('Text', null, children),
    Title: ({ children }: any) => React.createElement('Text', null, children),
    IconButton: ({ onPress }: any) => React.createElement('Button', { onPress }, null),
    useTheme: () => ({ colors: { primary: '#000' } }),
  };
});

// Mock react-navigation hooks to avoid importing full library
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => cb(),
}));

// Mock vector icons to simple component
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const React = require('react');
  return ({ name, size, color }: any) => React.createElement('Text', null, 'icon');
});

// Mock the auth store to be selector-aware
jest.mock('../src/stores/authStore', () => {
  const mockState = { user: { credits: 42 }, token: null, setUser: jest.fn(), setToken: jest.fn(), isHydrated: true };
  return (selector: any) => (typeof selector === 'function' ? selector(mockState) : mockState);
});

describe('ProfessionalStatsCard', () => {
  it('returns credits from store using helper', () => {
    const { getDisplayedCredits } = require('../src/components/ProfessionalStatsCard');
    const mockStore = { user: { credits: 42 } };
    expect(getDisplayedCredits(mockStore)).toBe(42);

    // fallback when user or credits missing
    expect(getDisplayedCredits({})).toBe(0);
    expect(getDisplayedCredits({ user: {} })).toBe(0);
  });
});
