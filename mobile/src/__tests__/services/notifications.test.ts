/**
 * Unit tests for notifications service
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  registerForPushNotificationsAsync,
  registerPushTokenOnServer,
  setupNotificationResponseListener,
  setupNotificationReceivedListener,
  setupAndroidNotificationChannels,
} from '../../services/notifications';
import * as authApi from '../../api/auth';
import useAuthStore from '../../stores/authStore';
import useChatStore from '../../stores/chatStore';

// Mock dependencies
jest.mock('expo-notifications');
jest.mock('expo-device');
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));
jest.mock('../../api/auth');
jest.mock('../../stores/authStore');
jest.mock('../../stores/chatStore');

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
const mockDevice = Device as jest.Mocked<typeof Device>;
const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

describe('Notifications Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock setup
    mockDevice.isDevice = true;
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
    } as any);
    mockNotifications.getDevicePushTokenAsync.mockResolvedValue({
      data: 'mock-token-123',
      type: 'expo',
    } as any);
  });

  describe('registerForPushNotificationsAsync', () => {
    it('should return null if not a physical device', async () => {
      mockDevice.isDevice = false;
      
      const result = await registerForPushNotificationsAsync();
      
      expect(result).toBeNull();
    });

    it('should return token when permission already granted', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'granted',
      } as any);
      
      const result = await registerForPushNotificationsAsync();
      
      expect(result).toBe('mock-token-123');
      expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should request permission if not granted', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
      } as any);
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'granted',
      } as any);
      
      const result = await registerForPushNotificationsAsync();
      
      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
      expect(result).toBe('mock-token-123');
    });

    it('should return null if permission denied', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
      } as any);
      mockNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'denied',
      } as any);
      
      const result = await registerForPushNotificationsAsync();
      
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockNotifications.getDevicePushTokenAsync.mockRejectedValue(
        new Error('Token error')
      );
      
      const result = await registerForPushNotificationsAsync();
      
      expect(result).toBeNull();
    });
  });

  describe('registerPushTokenOnServer', () => {
    beforeEach(() => {
      (useAuthStore.getState as jest.Mock) = jest.fn().mockReturnValue({
        token: 'auth-token-123',
      });
      mockDevice.deviceName = 'Test Device';
      mockDevice.osName = 'iOS';
      mockDevice.osVersion = '17.0';
      mockAuthApi.registerFcmToken.mockResolvedValue({});
    });

    it('should register token on server', async () => {
      const result = await registerPushTokenOnServer('device-token-123');
      
      expect(mockAuthApi.registerFcmToken).toHaveBeenCalledWith(
        'auth-token-123',
        'device-token-123',
        'Test Device',
        'iOS 17.0'
      );
      expect(result).toBe(true);
    });

    it('should return null if no auth token', async () => {
      (useAuthStore.getState as jest.Mock) = jest.fn().mockReturnValue({
        token: null,
      });
      
      const result = await registerPushTokenOnServer('device-token-123');
      
      expect(result).toBeNull();
      expect(mockAuthApi.registerFcmToken).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockAuthApi.registerFcmToken.mockRejectedValue(
        new Error('API error')
      );
      
      const result = await registerPushTokenOnServer('device-token-123');
      
      expect(result).toBe(false);
    });

    it('should handle missing device info', async () => {
      mockDevice.deviceName = undefined;
      mockDevice.osName = undefined;
      
      const result = await registerPushTokenOnServer('device-token-123');
      
      expect(mockAuthApi.registerFcmToken).toHaveBeenCalledWith(
        'auth-token-123',
        'device-token-123',
        undefined,
        undefined
      );
      expect(result).toBe(true);
    });
  });

  describe('setupNotificationResponseListener', () => {
    it('should add notification response listener', () => {
      const mockListener = jest.fn();
      mockNotifications.addNotificationResponseReceivedListener.mockReturnValue({
        remove: jest.fn(),
      } as any);
      
      const subscription = setupNotificationResponseListener();
      
      expect(mockNotifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
      expect(subscription).toBeTruthy();
    });

    it('should open chat on new_message notification', () => {
      const mockOpenChat = jest.fn();
      (useChatStore.getState as jest.Mock) = jest.fn().mockReturnValue({
        openChat: mockOpenChat,
      });
      
      let responseHandler: any;
      mockNotifications.addNotificationResponseReceivedListener.mockImplementation((handler) => {
        responseHandler = handler;
        return { remove: jest.fn() } as any;
      });
      
      setupNotificationResponseListener();
      
      // Simulate notification tap
      responseHandler({
        notification: {
          request: {
            content: {
              data: {
                type: 'new_message',
                contact_id: 'contact-123',
              },
            },
          },
        },
      });
      
      expect(mockOpenChat).toHaveBeenCalledWith('contact-123');
    });

    it('should open chat on new_contact notification', () => {
      const mockOpenChat = jest.fn();
      (useChatStore.getState as jest.Mock) = jest.fn().mockReturnValue({
        openChat: mockOpenChat,
      });
      
      let responseHandler: any;
      mockNotifications.addNotificationResponseReceivedListener.mockImplementation((handler) => {
        responseHandler = handler;
        return { remove: jest.fn() } as any;
      });
      
      setupNotificationResponseListener();
      
      // Simulate notification tap
      responseHandler({
        notification: {
          request: {
            content: {
              data: {
                type: 'new_contact',
                contact_id: 'contact-456',
              },
            },
          },
        },
      });
      
      expect(mockOpenChat).toHaveBeenCalledWith('contact-456');
    });

    it('should handle notification without contact_id', () => {
      const mockOpenChat = jest.fn();
      (useChatStore.getState as jest.Mock) = jest.fn().mockReturnValue({
        openChat: mockOpenChat,
      });
      
      let responseHandler: any;
      mockNotifications.addNotificationResponseReceivedListener.mockImplementation((handler) => {
        responseHandler = handler;
        return { remove: jest.fn() } as any;
      });
      
      setupNotificationResponseListener();
      
      // Simulate notification without contact_id
      responseHandler({
        notification: {
          request: {
            content: {
              data: {
                type: 'new_message',
              },
            },
          },
        },
      });
      
      expect(mockOpenChat).not.toHaveBeenCalled();
    });
  });

  describe('setupNotificationReceivedListener', () => {
    it('should add notification received listener', () => {
      mockNotifications.addNotificationReceivedListener.mockReturnValue({
        remove: jest.fn(),
      } as any);
      
      const subscription = setupNotificationReceivedListener();
      
      expect(mockNotifications.addNotificationReceivedListener).toHaveBeenCalled();
      expect(subscription).toBeTruthy();
    });

    it('should handle received notification', () => {
      let receivedHandler: any;
      mockNotifications.addNotificationReceivedListener.mockImplementation((handler) => {
        receivedHandler = handler;
        return { remove: jest.fn() } as any;
      });
      
      setupNotificationReceivedListener();
      
      // Should not throw
      expect(() => {
        receivedHandler({
          request: {
            content: {
              title: 'Test',
              body: 'Test notification',
            },
          },
        });
      }).not.toThrow();
    });
  });

  describe('Notification handler configuration', () => {
    it('should configure notification handler', () => {
      expect(mockNotifications.setNotificationHandler).toHaveBeenCalled();
    });
  });

  describe('setupAndroidNotificationChannels', () => {
    it('should create messages and default channels on Android', async () => {
      mockNotifications.setNotificationChannelAsync.mockResolvedValue(null as any);

      await setupAndroidNotificationChannels();

      expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'messages',
        expect.objectContaining({
          name: 'Mensagens',
          importance: Notifications.AndroidImportance.HIGH,
        })
      );
      expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({
          name: 'Notificações',
        })
      );
    });
  });
});
