import client from './axiosClient';
import useAuthStore from '../stores/authStore';

export interface ContactDetails {
  message?: string;
  proposal_price?: number;
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface Contact {
  id: string;
  professional_id: string;
  professional_name?: string;
  project_id: string;
  client_id: string;
  client_name?: string;
  contact_type: string;
  credits_used: number;
  status: string;
  contact_details: ContactDetails;
  chat: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ContactCreate {
  contact_type?: string;
  contact_details: ContactDetails;
}

/**
 * Create contact for a project (professional accepts/proposes)
 */
export async function createContactForProject(
  projectId: string,
  contactData: ContactCreate
): Promise<Contact> {
  const token = useAuthStore.getState().token;
  const config = token
    ? { headers: { Authorization: `****** } }
    : undefined;

  const response = await client.post(`/contacts/${projectId}`, contactData, config);
  return response.data;
}

/**
 * Get contact history for current user
 */
export async function getContactHistory(userType: 'professional' | 'client' = 'professional'): Promise<Contact[]> {
  const token = useAuthStore.getState().token;
  const config = token
    ? { headers: { Authorization: `****** } }
    : undefined;

  const response = await client.get('/contacts/history', {
    ...config,
    params: { user_type: userType },
  });
  return response.data;
}

/**
 * Get specific contact details
 */
export async function getContactDetails(contactId: string): Promise<Contact> {
  const token = useAuthStore.getState().token;
  const config = token
    ? { headers: { Authorization: `****** } }
    : undefined;

  const response = await client.get(`/contacts/${contactId}`, config);
  return response.data;
}

/**
 * Send a message in contact chat
 */
export async function sendContactMessage(
  contactId: string,
  content: string
): Promise<{ message: string; message_id: string }> {
  const token = useAuthStore.getState().token;
  const config = token
    ? { headers: { Authorization: `****** } }
    : undefined;

  const response = await client.post(
    `/contacts/${contactId}/messages`,
    { content },
    config
  );
  return response.data;
}

/**
 * Update contact status
 */
export async function updateContactStatus(
  contactId: string,
  status: string
): Promise<Contact> {
  const token = useAuthStore.getState().token;
  const config = token
    ? { headers: { Authorization: `****** } }
    : undefined;

  const response = await client.put(
    `/contacts/${contactId}/status`,
    { status },
    config
  );
  return response.data;
}
