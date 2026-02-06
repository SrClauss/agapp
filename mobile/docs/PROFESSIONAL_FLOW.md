# Professional Flow - Mobile App

This document describes the mobile app flow for professionals to view costs, spend credits, negotiate with clients, and evaluate projects.

## Overview

The professional flow consists of four main phases:

1. **Cost Preview**: View the credit cost before contacting a project
2. **Contact Creation**: Confirm and create a contact with credit deduction
3. **Negotiation**: Real-time chat with client via WebSocket
4. **Evaluation**: Rate and review the project after completion

## API Endpoints Used

### 1. Cost Preview

**Endpoint**: `GET /api/contacts/{project_id}/cost-preview`

**Description**: Preview the credit cost for contacting a project before committing.

**Response**:
```json
{
  "credits_cost": 3,
  "reason": "new_project",
  "current_balance": 10,
  "can_afford": true,
  "message": "Optional message"
}
```

**Pricing Reasons**:
- `new_project`: Project published less than 24 hours ago (3 credits)
- `moderate_interest`: 2-4 professionals already contacted (2 credits)
- `old_project` or `high_interest`: Project older than 7 days or 5+ contacts (1 credit)
- `contact_already_exists`: No cost, contact already exists

**Implementation**: `src/api/contacts.ts` - `getContactCostPreview()`

---

### 2. Create Contact

**Endpoint**: `POST /api/contacts/{project_id}`

**Description**: Create a contact with a project, deducting credits atomically.

**Request Body**:
```json
{
  "contact_type": "proposal",
  "contact_details": {
    "message": "Hello! I'm interested in this project.",
    "proposal_price": 5000.00
  }
}
```

**Response**:
```json
{
  "id": "contact_id",
  "professional_id": "prof_id",
  "project_id": "proj_id",
  "client_id": "client_id",
  "contact_type": "proposal",
  "credits_used": 3,
  "status": "pending",
  "contact_details": {...},
  "chat": [],
  "created_at": "2026-02-06T10:00:00Z",
  "updated_at": "2026-02-06T10:00:00Z"
}
```

**Error Responses**:
- `400 Insufficient credits`: User doesn't have enough credits
- `400 Contact already exists`: Contact already exists for this project
- `404 Project not found`: Project doesn't exist
- `403 Forbidden`: User is not a professional

**Implementation**: `src/api/contacts.ts` - `createContactForProject()`

---

### 3. Get Professional Credits

**Endpoint**: `GET /api/professionals/credits`

**Description**: Get current credit balance for the professional.

**Response**:
```json
{
  "credits_available": 10
}
```

**Implementation**: `src/api/professional.ts` - `getCreditsByProfessional()`

---

### 4. Contact Details & Chat

**Endpoint**: `GET /api/contacts/{contact_id}`

**Description**: Get contact details including full chat history.

**Response**:
```json
{
  "id": "contact_id",
  "professional_id": "prof_id",
  "professional_name": "Professional Name",
  "project_id": "proj_id",
  "client_id": "client_id",
  "client_name": "Client Name",
  "contact_type": "proposal",
  "credits_used": 3,
  "status": "active",
  "contact_details": {...},
  "chat": [
    {
      "id": "msg_id",
      "sender_id": "user_id",
      "content": "Hello!",
      "created_at": "2026-02-06T10:00:00Z"
    }
  ],
  "created_at": "2026-02-06T10:00:00Z",
  "updated_at": "2026-02-06T10:05:00Z"
}
```

**Implementation**: `src/api/contacts.ts` - `getContactDetails()`

---

### 5. Send Message

**Endpoint**: `POST /api/contacts/{contact_id}/messages`

**Description**: Send a message in the contact chat.

**Request Body**:
```json
{
  "content": "When can we start?"
}
```

**Response**:
```json
{
  "message": "Message sent",
  "message_id": "msg_id"
}
```

**Implementation**: `src/api/contacts.ts` - `sendContactMessage()`

---

### 6. Project Evaluation

**Endpoint**: `POST /api/projects/{project_id}/evaluate`

**Description**: Submit an evaluation/rating for a completed project.

**Request Body**:
```json
{
  "rating": 5,
  "comment": "Great project!",
  "would_recommend": true
}
```

**Response**:
```json
{
  "message": "Evaluation submitted successfully",
  "evaluation_id": "eval_id"
}
```

**Implementation**: `src/api/projects.ts` - `evaluateProject()`

---

## WebSocket Integration

### Connection

**URL**: `ws://<host>/ws/{user_id}?token={JWT}`

**Description**: Real-time bidirectional communication for chat messages and contact updates.

**Implementation**: `src/services/websocket.ts` - `createWebsocket()`

### Events

#### Received Events

1. **new_message**
```json
{
  "type": "new_message",
  "contact_id": "contact_id",
  "message_id": "msg_id",
  "sender_id": "user_id",
  "content": "Hello!",
  "created_at": "2026-02-06T10:00:00Z"
}
```

2. **contact_update**
```json
{
  "type": "contact_update",
  "contact_id": "contact_id",
  "status": "accepted",
  "updated_at": "2026-02-06T10:00:00Z"
}
```

3. **notification**
```json
{
  "type": "notification",
  "title": "New Message",
  "body": "You have a new message",
  "data": {
    "contact_id": "contact_id",
    "type": "new_message"
  }
}
```

---

## Components

### ConfirmContactModal

**Location**: `src/components/ConfirmContactModal.tsx`

**Purpose**: Display cost preview and confirm contact creation.

**Features**:
- Shows credit cost and pricing reason
- Displays current balance and balance after
- Handles insufficient credits with buy credits CTA
- Prevents double-clicks with loading state

**Props**:
```typescript
{
  visible: boolean;
  onDismiss: () => void;
  onConfirm: (message: string, proposalPrice?: number) => Promise<void>;
  costPreview: CostPreview | null;
  loading?: boolean;
}
```

---

### ContactDetailScreen

**Location**: `src/screens/ContactDetailScreen.tsx`

**Purpose**: Chat interface for negotiating with clients.

**Features**:
- Real-time message display with WebSocket
- Message input with send functionality
- Project info header
- Online status indicator
- Date separators for messages
- Optimistic UI updates

**Navigation Params**:
```typescript
{
  contactId: string;
}
```

---

### EvaluationModal

**Location**: `src/components/EvaluationModal.tsx`

**Purpose**: Collect ratings and reviews for completed projects.

**Features**:
- 5-star rating system
- Optional comment (500 chars)
- Recommendation toggle
- Form validation

**Props**:
```typescript
{
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (rating: number, comment: string, wouldRecommend: boolean) => Promise<void>;
  projectTitle: string;
  loading?: boolean;
}
```

---

## Screens

### ProjectProfessionalsDetailScreen

**Location**: `src/screens/ProjectProfessionalsDetailScreen.tsx`

**Purpose**: Display project details and initiate contact.

**Features**:
- Auto-load cost preview on mount
- Display credit cost on button
- Handle existing contacts
- Navigate to ContactDetailScreen after creation
- Refresh credits after transaction
- Error handling with retry and buy credits options

**Flow**:
1. User views project details
2. Cost preview loads automatically
3. Button shows "Contatar — X créditos"
4. On tap, ConfirmContactModal opens
5. On confirm, contact is created
6. Credits are refreshed
7. Navigate to ContactDetailScreen

---

## Security

- **JWT Authentication**: All API calls include `Authorization: Bearer {token}` header
- **Role Validation**: Backend ensures user has `professional` role
- **Atomic Transactions**: Credit deduction uses database locking to prevent race conditions
- **Idempotency**: Duplicate contact creation returns 400 error
- **Rate Limiting**: Backend implements rate limiting on sensitive endpoints

---

## Error Handling

### Network Errors
- Display retry dialog with option to retry operation
- Show offline indicator when network is unavailable

### Business Logic Errors
- **Insufficient Credits**: Show buy credits dialog with navigation
- **Contact Exists**: Navigate to existing contact/chat
- **Project Not Found**: Show error and navigate back
- **Unauthorized**: Redirect to login

### UI/UX
- Loading states on all async operations
- Optimistic UI updates with reconciliation
- Snackbar notifications for success/error messages
- Disable buttons during operations to prevent double-clicks

---

## Testing

### Unit Tests

**Location**: `src/__tests__/api/contacts.test.ts`

**Coverage**:
- ✅ Cost preview fetch
- ✅ Insufficient credits handling
- ✅ Existing contact handling
- ✅ Contact creation success
- ✅ Contact already exists error
- ✅ Insufficient credits error
- ✅ Message sending

### Integration Tests (TODO)
- End-to-end flow from project detail to chat
- WebSocket message reception
- Credit balance updates
- Navigation between screens

### Manual Testing
- Test on slow networks
- Test rapid button clicks
- Test WebSocket reconnection
- Test push notifications

---

## Future Enhancements

1. **Push Notifications**: Full FCM integration for background messages
2. **Credit Purchase Flow**: Implement buy credits screen
3. **Offline Queue**: Queue contact creation when offline
4. **Message Attachments**: Support images and files in chat
5. **Read Receipts**: Show when messages are read
6. **Typing Indicators**: Show when other party is typing
7. **Project Evaluation Triggers**: Auto-show evaluation modal when project closes

---

## Dependencies

- `reconnecting-websocket`: WebSocket with automatic reconnection
- `react-native-paper`: UI components (Dialog, Button, TextInput)
- `@react-navigation/native`: Navigation between screens
- `zustand`: State management for auth and user data
- `axios`: HTTP client with retry logic
- `expo-notifications`: Push notifications (infrastructure exists)

---

## Environment Variables

```env
EXPO_PUBLIC_API_URL=https://api.example.com
```

WebSocket URL is derived by replacing `http` with `ws` in the API URL.

---

## Debugging

Enable debug logs:
```typescript
// In useWebSocket or ContactDetailScreen
console.log('[ContactDetail] WebSocket message:', data);
console.log('[ProjectProfessionalsDetail] Cost preview:', costPreview);
```

Check auth token:
```typescript
useAuthStore.getState().debugCheckPersisted?.();
```

---

## License

MIT
