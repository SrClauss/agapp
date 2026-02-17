# Push Notification Implementation

## Overview
This implementation adds Firebase Cloud Messaging (FCM) push notifications to the AgilizaPro mobile app.

## Features Implemented

### 1. Push Notifications
- **When Professional Contacts a Client**: Client receives a notification with the professional's information
- **When New Chat Message Arrives**: Recipient receives a notification with message preview
- **Notification Handler**: Automatically opens ChatModal when user taps a notification

### 2. Chat Modal
- **Global Chat Modal**: Accessible from anywhere in the app via the `useChatStore` hook
- **Profile Cards**: Shows sender's profile (avatar, name, role) at the top of the chat
- **Real-time Messaging**: Uses WebSocket for instant message delivery
- **Message History**: Loads chat history from database
- **Safe Area**: Properly handles device safe areas and keyboard

### 3. Integration Points

#### From Project Detail Screens
- **ProjectProfessionalsDetailScreen**: When professional creates a contact, opens ChatModal
- **ProjectClientDetailScreen**: Client can tap on a contacted professional to open ChatModal
- **ProfileCard Component**: Shows client profile when contact exists, with "Chat" button

#### From Notifications
- Tapping a notification (new_message or new_contact) automatically opens ChatModal

#### From Contact List
- **ProjectContactsList**: List of professionals who contacted a project, tapping opens ChatModal

## Components Created

### ChatModal
Path: `mobile/src/components/ChatModal.tsx`

A full-screen modal with:
- ProfileCard showing the other user
- Scrollable message list
- Message input with send button
- Real-time updates via WebSocket
- Auto-scroll to latest messages

### ProfileCard
Path: `mobile/src/components/ProfileCard.tsx`

A reusable card component displaying:
- User avatar (or initials fallback)
- Full name
- Role (Cliente/Profissional)
- Email and phone (optional)
- Chat button (optional)

### Chat Store
Path: `mobile/src/stores/chatStore.ts`

Global state management for chat:
- `isChatOpen`: Boolean indicating if chat modal is open
- `activeContactId`: Current contact ID being displayed
- `openChat(contactId)`: Function to open chat with specific contact
- `closeChat()`: Function to close the chat modal

## Configuration Changes

### app.json
Added expo-notifications plugin for push notification support:
```json
{
  "plugins": [
    "expo-secure-store",
    "@react-native-google-signin/google-signin",
    [
      "expo-notifications",
      {
        "icon": "./assets/icon.png",
        "color": "#ffffff",
        "sounds": ["./assets/notification.wav"],
        "mode": "production"
      }
    ]
  ]
}
```

### Notification Service
Updated `mobile/src/services/notifications.ts`:
- `setupNotificationResponseListener()`: Handles notification taps, opens ChatModal
- `setupNotificationReceivedListener()`: Handles foreground notifications
- Enhanced notification handler to show alerts, play sounds, and show badges

### App.tsx
- Added ChatModal as global component
- Setup notification listeners on app start
- Registers push token with server when user logs in

## Backend

The backend already had complete FCM support:
- `app/core/firebase.py`: Firebase Admin SDK integration
- `app/api/websockets/manager.py`: Sends push notifications when user is offline
- `app/api/endpoints/projects.py`: Sends notification when professional creates contact

## How It Works

### Flow 1: Professional Contacts Client

1. Professional views a project and taps "Contact" button
2. After confirmation, contact is created via API
3. Backend sends push notification to client's device
4. If client is offline, notification appears in system tray
5. Professional sees client ProfileCard with chat button
6. Tapping chat button opens ChatModal
7. Messages are sent via API and delivered in real-time via WebSocket

### Flow 2: Client Receives Notification

1. Client receives push notification on their device
2. Client taps the notification
3. App opens and `setupNotificationResponseListener` is triggered
4. `useChatStore.openChat(contactId)` is called
5. ChatModal opens with the conversation
6. Client can read messages and reply

### Flow 3: Real-time Messaging

1. User types message and taps send
2. Message is sent via `sendContactMessage` API
3. Backend saves message to database
4. Backend broadcasts via WebSocket to both participants
5. ChatModal receives WebSocket message and adds it to the list
6. If recipient is offline, they receive push notification

## Testing Recommendations

1. **Notification Reception**:
   - Test on physical device (notifications don't work in simulator)
   - Create a contact as professional
   - Verify client receives notification

2. **ChatModal Opening**:
   - From notification tap
   - From ProjectProfessionalsDetailScreen (after creating contact)
   - From ProjectClientDetailScreen (tap on contacted professional)

3. **Real-time Messaging**:
   - Open chat on two devices
   - Send message from one device
   - Verify it appears on the other device instantly

4. **Message History**:
   - Close and reopen chat
   - Verify all previous messages are loaded

## Known Limitations

1. Push notifications only work on physical devices
2. Notification sound file (`assets/notification.wav`) may need to be created
3. Location-based chat (from LocationAvatar) not yet implemented but can be added easily

## Future Enhancements

1. Add chat button to LocationAvatar header for quick access
2. Add notification badges to show unread message count
3. Add typing indicators
4. Add message delivery/read receipts
5. Add image/file sharing in chat
6. Add push notification for other events (project updates, etc.)
