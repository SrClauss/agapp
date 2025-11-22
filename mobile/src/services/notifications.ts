import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { registerFcmToken } from '../api/auth';
import useAuthStore, { AuthState } from '../stores/authStore';

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

// Optional: configure a foreground notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: false,
  }),
});

export default {
  registerForPushNotificationsAsync,
  registerPushTokenOnServer,
};
