/**
 * Unit tests for locationStore (Zustand state management)
 */
import { renderHook, act } from '@testing-library/react-native';
import { useLocationStore } from '../../stores/locationStore';

// Mock expo-location before importing
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: {
    Balanced: 1,
  },
}));

// Import mocked functions
import * as Location from 'expo-location';

describe('LocationStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useLocationStore.setState({
      coords: undefined,
      locationText: undefined,
      neighborhood: undefined,
      loading: false,
      error: undefined,
    });
  });

  describe('Initial State', () => {
    it('should have undefined coords and locationText initially', () => {
      const { result } = renderHook(() => useLocationStore());
      
      expect(result.current.coords).toBeUndefined();
      expect(result.current.locationText).toBeUndefined();
      expect(result.current.neighborhood).toBeUndefined();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });
  });

  describe('setLocation', () => {
    it('should set location data', () => {
      const { result } = renderHook(() => useLocationStore());
      
      act(() => {
        result.current.setLocation({
          coords: [-46.6333, -23.5505],
          locationText: 'São Paulo, SP',
          neighborhood: 'Centro',
        });
      });
      
      expect(result.current.coords).toEqual([-46.6333, -23.5505]);
      expect(result.current.locationText).toBe('São Paulo, SP');
      expect(result.current.neighborhood).toBe('Centro');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it('should set partial location data', () => {
      const { result } = renderHook(() => useLocationStore());
      
      act(() => {
        result.current.setLocation({
          locationText: 'Rio de Janeiro, RJ',
        });
      });
      
      expect(result.current.locationText).toBe('Rio de Janeiro, RJ');
      expect(result.current.coords).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all location data', () => {
      const { result } = renderHook(() => useLocationStore());
      
      act(() => {
        result.current.setLocation({
          coords: [-46.6333, -23.5505],
          locationText: 'São Paulo, SP',
          neighborhood: 'Centro',
        });
        result.current.clear();
      });
      
      expect(result.current.coords).toBeUndefined();
      expect(result.current.locationText).toBeUndefined();
      expect(result.current.neighborhood).toBeUndefined();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });
  });

  describe('fetchLocation', () => {
    it('should fetch and set location successfully', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
        granted: true,
        expires: 'never',
      } as any);

      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: {
          latitude: -23.5505,
          longitude: -46.6333,
          altitude: null,
          accuracy: 10,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as any);

      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        {
          city: 'São Paulo',
          region: 'SP',
          district: 'Centro',
          street: null,
          streetNumber: null,
          name: null,
          postalCode: null,
          country: null,
          subregion: null,
          isoCountryCode: null,
          timezone: null,
        },
      ] as any);

      const { result } = renderHook(() => useLocationStore());
      
      await act(async () => {
        await result.current.fetchLocation();
      });
      
      expect(result.current.coords).toEqual([-46.6333, -23.5505]);
      expect(result.current.locationText).toBe('São Paulo, SP');
      expect(result.current.neighborhood).toBe('Centro');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it('should handle permission denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        canAskAgain: false,
        granted: false,
        expires: 'never',
      } as any);

      const { result } = renderHook(() => useLocationStore());
      
      await act(async () => {
        await result.current.fetchLocation();
      });
      
      expect(result.current.locationText).toBe('Localização não permitida');
      expect(result.current.error).toBe('permission_denied');
      expect(result.current.loading).toBe(false);
    });

    it('should handle location fetch error', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
        granted: true,
        expires: 'never',
      } as any);

      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(
        new Error('Location service unavailable')
      );

      const { result } = renderHook(() => useLocationStore());
      
      await act(async () => {
        await result.current.fetchLocation();
      });
      
      expect(result.current.locationText).toBe('Erro ao obter localização');
      expect(result.current.error).toBe('Location service unavailable');
      expect(result.current.loading).toBe(false);
    });

    it('should handle missing address data', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
        granted: true,
        expires: 'never',
      } as any);

      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: {
          latitude: -23.5505,
          longitude: -46.6333,
          altitude: null,
          accuracy: 10,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as any);

      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
        {
          city: null,
          region: null,
          district: null,
          street: null,
          streetNumber: null,
          name: null,
          postalCode: null,
          country: null,
          subregion: null,
          isoCountryCode: null,
          timezone: null,
        },
      ] as any);

      const { result } = renderHook(() => useLocationStore());
      
      await act(async () => {
        await result.current.fetchLocation();
      });
      
      expect(result.current.locationText).toBe('Localização desconhecida');
      expect(result.current.coords).toEqual([-46.6333, -23.5505]);
    });
  });
});
