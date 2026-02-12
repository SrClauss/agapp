# Testing Guide: Push Notifications & Chat Modal

## Prerequisites

1. **Physical Android/iOS Device**: Push notifications do not work on simulators
2. **Firebase Configuration**: Ensure google-services.json is in place
3. **Backend Running**: Backend must be accessible and Firebase Admin SDK configured
4. **Two Test Accounts**: One as client, one as professional

## Environment Setup

### Build the App
```bash
cd mobile
npm install
expo prebuild  # Generate native projects
expo run:android  # For Android
# OR
expo run:ios  # For iOS (requires Mac)
```

### Verify Firebase Configuration
1. Check that `mobile/google-services.json` exists
2. Backend should have Firebase credentials configured

## Test Scenarios

### Test 1: Push Notification Registration
**Objective**: Verify push token is registered on login

**Steps**:
1. Launch app on physical device
2. Login as any user
3. Accept notification permission prompt
4. Check backend logs for "Push notifications registered" message
5. Verify in backend database that user has `fcm_tokens` array with device token

**Expected Result**:
- User successfully registered for push notifications
- Device token stored in database

---

### Test 2: Professional Creates Contact → Client Receives Notification
**Objective**: Test notification when professional contacts a project

**Steps**:
1. **Client Device**: Login as client, create a project
2. **Professional Device**: Login as professional, browse projects
3. **Professional Device**: Find the client's project, tap "Contact"
4. **Professional Device**: Confirm contact creation (uses credits)
5. **Client Device**: Should receive push notification
6. **Client Device**: Tap the notification

**Expected Result**:
- Client receives notification: "Nova Proposta Recebida"
- Tapping notification opens ChatModal with professional's profile card
- Chat is ready for messaging

---

### Test 3: Real-time Message Delivery via WebSocket
**Objective**: Test real-time chat functionality

**Steps**:
1. Complete Test 2 to create a contact
2. **Both Devices**: Keep app open
3. **Professional Device**: Open chat with client
4. **Professional Device**: Send message "Hello!"
5. **Client Device**: Should see message appear instantly
6. **Client Device**: Reply "Hi there!"
7. **Professional Device**: Should see reply instantly

**Expected Result**:
- Messages appear in real-time on both devices
- No page refresh needed
- Messages display correctly (right alignment for own messages, left for others)
- Timestamps show correctly

---

### Test 4: Push Notification When Recipient is Offline
**Objective**: Test push notification fallback when WebSocket is disconnected

**Steps**:
1. **Client Device**: Close the app completely (swipe away)
2. **Professional Device**: Open chat, send message
3. **Client Device**: Should receive push notification in system tray
4. **Client Device**: Tap notification
5. **Client Device**: App opens with ChatModal showing conversation

**Expected Result**:
- Push notification appears in system tray
- Notification shows message preview
- Tapping opens app directly to chat
- Message history loads correctly

---

### Test 5: ChatModal Opening from Different Entry Points
**Objective**: Verify ChatModal can be opened from various places

**5a. From Project Detail (Professional View)**:
1. Professional views a project they contacted
2. Should see client ProfileCard with "Chat" button
3. Tap Chat button
4. ChatModal opens

**5b. From Project Detail (Client View)**:
1. Client views their project
2. Should see list of professionals who contacted
3. Tap on a professional
4. ChatModal opens

**5c. From Notification**:
1. Receive push notification
2. Tap notification
3. ChatModal opens directly

**Expected Result**:
- ChatModal opens correctly from all entry points
- Correct conversation is displayed
- Real-time updates work in all cases

---

### Test 6: Message History Persistence
**Objective**: Verify messages are saved and loaded correctly

**Steps**:
1. Open chat, send several messages
2. Close ChatModal
3. Close app completely
4. Reopen app
5. Open same chat again

**Expected Result**:
- All previous messages are displayed
- Messages in correct chronological order
- No duplicates

---

### Test 7: Multiple Devices, Same User
**Objective**: Test behavior when user logged in on multiple devices

**Steps**:
1. Login as same user on two devices
2. Send message from Device A
3. Check Device B receives notification (if app is closed)
4. Open chat on Device B
5. Verify message is there

**Expected Result**:
- Both devices receive push notifications
- Messages synchronized across devices
- No conflicts or duplicates

---

### Test 8: Notification Permissions Denied
**Objective**: Verify graceful handling when permissions denied

**Steps**:
1. Login to app
2. Deny notification permission when prompted
3. Professional creates contact
4. Verify WebSocket still works for real-time messaging

**Expected Result**:
- App doesn't crash
- Real-time messaging still works via WebSocket
- User just won't receive push notifications when app is closed

---

### Test 9: Network Interruption Recovery
**Objective**: Test WebSocket reconnection

**Steps**:
1. Open chat with WebSocket connected
2. Turn off WiFi/data on device
3. Wait 10 seconds
4. Turn WiFi/data back on
5. Send message from other device

**Expected Result**:
- WebSocket automatically reconnects
- New messages appear after reconnection
- No data loss

---

### Test 10: Invalid/Expired Token Cleanup
**Objective**: Verify invalid tokens are removed

**Steps**:
1. Login on device
2. Manually invalidate token in Firebase console
3. Professional sends message
4. Check backend logs

**Expected Result**:
- Backend attempts to send notification
- Detects invalid token
- Removes invalid token from database
- Logs the removal

---

## Performance Tests

### Load Test: Multiple Messages
1. Send 50+ messages rapidly
2. Verify UI remains responsive
3. Check for memory leaks
4. Verify auto-scroll works correctly

### Background Behavior Test
1. Open chat
2. Send message
3. Put app in background
4. Receive reply
5. Check notification appears
6. Bring app to foreground
7. Verify chat updates

---

## Troubleshooting

### Notifications Not Received
- Check device notification settings
- Verify Firebase configuration
- Check backend logs for errors
- Verify FCM token in database
- Ensure device has internet connection

### WebSocket Not Connecting
- Check backend WebSocket endpoint is accessible
- Verify authentication token is valid
- Check network connectivity
- Look for CORS issues in backend logs

### Messages Not Appearing
- Verify WebSocket connection status
- Check browser console for errors
- Verify contact ID is correct
- Check message API response

### App Crashes
- Check for TypeScript compilation errors
- Verify all dependencies installed
- Check for missing imports
- Review error logs

---

## Success Criteria

✅ Push notifications delivered within 5 seconds  
✅ Real-time messages appear instantly  
✅ ChatModal opens from all entry points  
✅ Message history persists correctly  
✅ No duplicate messages  
✅ Graceful error handling  
✅ Works on both Android and iOS  
✅ Network interruption recovery  
✅ Invalid token cleanup  

---

## Reporting Issues

When reporting issues, please include:
- Device model and OS version
- App version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/screen recordings
- Relevant log messages

---

## Next Steps After Testing

1. Fix any bugs discovered
2. Optimize performance if needed
3. Add analytics to track notification delivery rates
4. Consider A/B testing notification content
5. Plan for production rollout
