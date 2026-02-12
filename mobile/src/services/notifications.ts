import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { registerFcmToken } from '../api/auth';
import useAuthStore, { AuthState } from '../stores/authStore';
import useChatStore from '../stores/chatStore';

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Permission for push notifications not granted');
    return null;
  }

  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;
    return token;
  } catch (e) {
    console.warn('Failed to get device push token', e);
    return null;
  }
}

export async function registerPushTokenOnServer(deviceToken: string) {
  const token = useAuthStore.getState().token;
  if (!token) return null;

  try {
    const deviceId = Device.deviceName || Device.modelName || undefined;
    const deviceName = `${Device.osName || ''} ${Device.osVersion || ''}`.trim() || undefined;
    await registerFcmToken(token, deviceToken, deviceId, deviceName);
    return true;
  } catch (e) {
    console.warn('Failed to register push token on server', e);
    return false;
  }
}

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Handle notification responses (when user taps on notification)
export function setupNotificationResponseListener() {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    
    // Handle different notification types
    if (data.type === 'new_message' || data.type === 'new_contact') {
      const contactId = data.contact_id as string;
      if (contactId) {
        // Open chat modal with the contact
        useChatStore.getState().openChat(contactId);
      }
    }
    // Add more notification type handlers as needed
  });
}

// Handle notifications received while app is in foreground
export function setupNotificationReceivedListener() {
  return Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received in foreground:', notification);
    // You can customize foreground notification behavior here
  });
}

export default {
  registerForPushNotificationsAsync,
  registerPushTokenOnServer,
  setupNotificationResponseListener,
  setupNotificationReceivedListener,
};
