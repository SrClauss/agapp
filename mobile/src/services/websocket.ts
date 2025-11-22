import ReconnectingWebSocket from 'reconnecting-websocket';
import { AuthState } from '../stores/authStore';
import useAuthStore from '../stores/authStore';

const BACKEND_URL = process.env.BACKEND_URL || 'https://agilizapro.cloud';

export function createWebsocket(userId: string) {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('No auth token for WebSocket connection');
  const url = `${BACKEND_URL.replace('http', 'ws')}/ws/${userId}?token=${token}`;
  const ws = new ReconnectingWebSocket(url, [], { WebSocket: WebSocket });
  return ws;
}

// Example usage:
// const ws = createWebsocket(userId);
// ws.addEventListener('open', () => console.log('connected'));
// ws.addEventListener('message', (msg) => console.log('msg', msg.data));

export default { createWebsocket };
