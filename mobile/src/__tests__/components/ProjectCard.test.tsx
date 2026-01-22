/**
 * Unit tests for ProjectCard component
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProjectCard from '../../components/ProjectCard';

// Mock react-native-paper components
jest.mock('react-native-paper', () => ({
  Card: ({ children, onPress, ...props }: any) => {
    const { TouchableRipple } = require('react-native');
    return (
      <TouchableRipple onPress={onPress} testID={props.testID}>
        {children}
      </TouchableRipple>
    );
  },
  Title: ({ children }: any) => {
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
  Paragraph: ({ children }: any) => {
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
  Chip: ({ children }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View>
        <Text>{children}</Text>
      </View>
    );
  },
  IconButton: ({ onPress, testID }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} testID={testID}>
        <Text>Icon</Text>
      </TouchableOpacity>
    );
  },
}));

describe('ProjectCard', () => {
  const mockProject = {
    id: 'proj123',
    title: 'Test Project',
    description: 'This is a test project description',
    category: {
      main: 'Technology',
      sub: 'Web Development',
    },
    budget_min: 1000,
    budget_max: 5000,
    status: 'open',
    created_at: '2025-01-20T10:00:00Z',
    client_name: 'John Doe',
    location: {
      address: { formatted: 'São Paulo, SP' },
    },
    remote_execution: false,
    badges: ['new'],
  };

  it('should render project title', () => {
    const { getByText } = render(<ProjectCard project={mockProject} />);
    
    expect(getByText('Test Project')).toBeTruthy();
  });

  it('should render project description', () => {
    const { getByText } = render(<ProjectCard project={mockProject} />);
    
    expect(getByText('This is a test project description')).toBeTruthy();
  });

  it('should render budget range', () => {
    const { getByText } = render(<ProjectCard project={mockProject} />);
    
    // Should display formatted budget
    expect(getByText(/R\$\s*1\.000/)).toBeTruthy();
    expect(getByText(/R\$\s*5\.000/)).toBeTruthy();
  });

  it('should call onPress when card is pressed', () => {
    const onPressMock = jest.fn();
    const { getByTestID } = render(
      <ProjectCard project={mockProject} onPress={onPressMock} testID="project-card" />
    );
    
    const card = getByTestID('project-card');
    fireEvent.press(card);
    
    expect(onPressMock).toHaveBeenCalledWith(mockProject);
  });

  it('should render "new" badge for recent projects', () => {
    const { getByText } = render(<ProjectCard project={mockProject} />);
    
    expect(getByText('new')).toBeTruthy();
  });

  it('should render "featured" badge for featured projects', () => {
    const featuredProject = {
      ...mockProject,
      badges: ['featured'],
    };
    
    const { getByText } = render(<ProjectCard project={featuredProject} />);
    
    expect(getByText('featured')).toBeTruthy();
  });

  it('should render location for non-remote projects', () => {
    const { getByText } = render(<ProjectCard project={mockProject} />);
    
    expect(getByText('São Paulo, SP')).toBeTruthy();
  });

  it('should show "Remote" for remote projects', () => {
    const remoteProject = {
      ...mockProject,
      remote_execution: true,
    };
    
    const { getByText } = render(<ProjectCard project={remoteProject} />);
    
    expect(getByText(/Remote/i)).toBeTruthy();
  });

  it('should render category information', () => {
    const { getByText } = render(<ProjectCard project={mockProject} />);
    
    expect(getByText(/Technology/)).toBeTruthy();
    expect(getByText(/Web Development/)).toBeTruthy();
  });

  it('should render client name', () => {
    const { getByText } = render(<ProjectCard project={mockProject} />);
    
    expect(getByText(/John Doe/)).toBeTruthy();
  });

  it('should handle projects without optional fields', () => {
    const minimalProject = {
      id: 'proj456',
      title: 'Minimal Project',
      description: 'Basic description',
      status: 'open',
      created_at: '2025-01-20T10:00:00Z',
    };
    
    const { getByText } = render(<ProjectCard project={minimalProject} />);
    
    expect(getByText('Minimal Project')).toBeTruthy();
    expect(getByText('Basic description')).toBeTruthy();
  });

  it('should not crash with null/undefined project', () => {
    const { container } = render(<ProjectCard project={null as any} />);
    
    expect(container).toBeTruthy();
  });
});
