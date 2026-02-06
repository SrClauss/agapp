# Manual Testing Guide - Professional Flow

This guide helps you manually test the professional flow implementation.

## Prerequisites

1. **Backend Running**: Ensure the backend API is running and accessible
2. **Test Users**: Have at least 2 test accounts:
   - Professional account with credits
   - Client account with an open project
3. **Mobile App**: App compiled and running on device/emulator

## Test Scenarios

### 1. Cost Preview

**Steps**:
1. Log in as a professional
2. Navigate to an open project (via search/nearby/all projects)
3. Observe the "Contatar — X créditos" button

**Expected**:
- Button shows correct credit cost
- If contact exists, shows "Ver Conversa Existente"
- If insufficient credits, button shows "Créditos Insuficientes"

**Test Cases**:
- ✅ New project (< 24h old) should cost 3 credits
- ✅ Project with 2-4 contacts should cost 2 credits
- ✅ Old project or 5+ contacts should cost 1 credit
- ✅ Existing contact should show 0 credits

---

### 2. Confirm Contact Modal

**Steps**:
1. On project detail screen, tap the contact button
2. Review the modal information

**Expected**:
- Modal shows credit cost with reason label
- Shows current balance
- Shows balance after deduction
- Cancel and Confirm buttons visible

**Test Cases**:
- ✅ Can cancel without deduction
- ✅ Insufficient credits shows "Comprar Créditos" button
- ✅ Confirm button disabled while loading

---

### 3. Create Contact

**Steps**:
1. In confirm modal, tap "Confirmar"
2. Wait for operation to complete

**Expected**:
- Loading spinner appears
- Credits deducted from balance
- Success message shown
- Navigates away or shows chat option

**Test Cases**:
- ✅ Credits updated in user state
- ✅ Can't create duplicate contact (shows error)
- ✅ Network error shows retry dialog
- ✅ Insufficient credits shows buy dialog

---

### 4. Chat Interface

**Steps**:
1. Navigate to contact detail screen (contact ID needed)
2. Send a message
3. Receive a message from other user

**Expected**:
- Messages display in chronological order
- Own messages on right (blue), others on left (white)
- Timestamps shown
- Date separators for different days

**Test Cases**:
- ✅ Can send messages
- ✅ Emoji and special characters work
- ✅ Long messages wrap correctly
- ✅ Scroll to bottom on new message
- ✅ Online indicator appears when connected

---

### 5. WebSocket Real-Time Updates

**Steps**:
1. Have chat open on professional's device
2. Send message from client's device
3. Observe real-time update

**Expected**:
- Message appears instantly without refresh
- No duplicate messages
- Connection indicator shows "Online"

**Test Cases**:
- ✅ Messages arrive in real-time
- ✅ Reconnects after network interruption
- ✅ Handles multiple messages quickly

---

### 6. Project Evaluation

**Steps**:
1. Have a project closed by backend/admin
2. Open the contact detail screen
3. Evaluation modal should appear automatically

**Expected**:
- Modal appears 1.5s after loading closed project
- Can select 1-5 stars
- Can add optional comment (500 chars max)
- Can select yes/no for recommendation

**Test Cases**:
- ✅ Can't submit without rating
- ✅ Comment is optional
- ✅ Shows success message on submit
- ✅ Doesn't show again after evaluation

---

## Error Testing

### Insufficient Credits
**Setup**: Ensure user has < 3 credits

**Expected**:
- Button shows "Créditos Insuficientes"
- Tapping shows buy credits alert
- Can't proceed without credits

### Contact Already Exists
**Setup**: Create contact, then try again

**Expected**:
- Shows "Ver Conversa Existente" button
- Tapping navigates to chat
- No credits deducted

### Network Errors
**Setup**: Disable network during operation

**Expected**:
- Shows network error dialog
- Offers retry option
- Restores button state

### Rate Limiting
**Setup**: Create many contacts rapidly

**Expected**:
- Backend returns 429 status
- Shows appropriate error
- Suggests waiting

---

## Performance Testing

### Fast Clicks
**Test**: Rapidly tap contact button

**Expected**:
- Only one contact created
- Button disabled during operation
- No race conditions

### Slow Network
**Test**: Enable network throttling

**Expected**:
- Loading indicators appear
- Operations don't timeout prematurely
- Graceful error handling

### Large Chat History
**Test**: Load contact with 100+ messages

**Expected**:
- Renders smoothly
- Scroll works correctly
- Memory usage reasonable

---

## Debugging Tips

### Enable Debug Logging

Add to your test:
```typescript
console.log('[Test] Cost preview:', costPreview);
console.log('[Test] User credits:', user?.credits);
console.log('[Test] WebSocket state:', wsConnected);
```

### Check Network Requests

Use React Native Debugger or Metro bundler:
```bash
# In terminal where Metro is running
npx react-native log-android  # or log-ios
```

### Inspect Auth State

```typescript
// In any component
const authState = useAuthStore.getState();
console.log('Auth State:', authState);
```

### WebSocket Connection

```typescript
// Check WebSocket events
ws.addEventListener('open', () => console.log('WS Connected'));
ws.addEventListener('error', (e) => console.log('WS Error:', e));
ws.addEventListener('close', () => console.log('WS Closed'));
```

---

## Test Data Setup

### Create Test Professional

```bash
curl -X POST https://api.example.com/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "prof@test.com",
    "password": "test123",
    "full_name": "Test Professional",
    "cpf": "12345678901",
    "roles": ["professional"]
  }'
```

### Add Credits to Professional

```bash
curl -X POST https://api.example.com/api/admin/users/{user_id}/credits \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "credits": 10,
    "reason": "Test credits"
  }'
```

### Create Test Project

```bash
curl -X POST https://api.example.com/api/projects \
  -H "Authorization: Bearer {client_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Project",
    "description": "Test description",
    "category": {"main": "Construção", "sub": "Reforma"},
    "status": "open"
  }'
```

---

## Checklist

Use this checklist to track your testing:

- [ ] Cost preview loads correctly
- [ ] Credit amounts are accurate
- [ ] Modal displays all information
- [ ] Contact creation succeeds
- [ ] Credits are deducted
- [ ] Duplicate prevention works
- [ ] Chat interface loads
- [ ] Can send messages
- [ ] Can receive messages
- [ ] WebSocket connects
- [ ] Real-time updates work
- [ ] Evaluation modal appears for closed projects
- [ ] Can submit evaluation
- [ ] Insufficient credits handled
- [ ] Network errors handled
- [ ] Fast clicks prevented
- [ ] All buttons responsive
- [ ] No crashes or errors

---

## Reporting Issues

When reporting issues, include:

1. **Device/Emulator**: iOS/Android version
2. **Steps to Reproduce**: Detailed steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happened
5. **Logs**: Console logs and error messages
6. **Screenshots**: If UI-related

---

## Notes

- Backend must have the following endpoints implemented:
  - GET `/api/contacts/{project_id}/cost-preview`
  - POST `/api/contacts/{project_id}`
  - GET `/api/professionals/credits`
  - POST `/api/projects/{project_id}/evaluate`
  - WebSocket at `ws://<host>/ws/{user_id}?token={JWT}`

- FCM push notifications require additional setup in `firebase-messaging-sw.js`

- For production testing, ensure:
  - SSL certificates valid
  - CORS properly configured
  - Rate limiting appropriate
  - Database backups in place
