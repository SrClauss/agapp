import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { ProfileCard } from './ProfileCard';
import { ChatMessage, Contact, getContactDetails, sendContactMessage, markContactMessagesAsRead } from '../api/contacts';
import useAuthStore from '../stores/authStore';
import { createWebsocket } from '../services/websocket';
import ReconnectingWebSocket from 'reconnecting-websocket';

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  contactId: string;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  visible,
  onClose,
  contactId,
}) => {
  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const userId = useAuthStore((state) => state.user?.id);
  const wsRef = useRef<ReconnectingWebSocket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Load contact details
  useEffect(() => {
    if (visible && contactId) {
      loadContact();
    }
  }, [visible, contactId]);

  // Setup WebSocket
  useEffect(() => {
    if (!visible || !userId) return;

    try {
      const ws = createWebsocket(userId);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        console.log('WebSocket connected');
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_message' && data.contact_id === contactId) {
            const newMessage = data.message;
            setMessages((prev) => [...prev, newMessage]);
            
            // Scroll to bottom
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
    }
  }, [visible, userId, contactId]);

  // Mark messages as read when opening
  useEffect(() => {
    if (visible && contactId) {
      markContactMessagesAsRead(contactId).catch(console.error);
    }
  }, [visible, contactId]);

  const loadContact = async () => {
    try {
      setLoading(true);
      const data = await getContactDetails(contactId);
      setContact(data);
      setMessages(data.chat || []);
      
      // Scroll to bottom after loading
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error loading contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      // Send via API (will also broadcast via WebSocket)
      await sendContactMessage(contactId, messageText);
      
      // Reload to get the new message (it will come via WebSocket too, but this ensures consistency)
      await loadContact();
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(messageText); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMyMessage = item.sender_id === userId;
    
    return (
      <View
        style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessage : styles.theirMessage,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.theirMessageText,
          ]}
        >
          {item.content}
        </Text>
        <Text
          style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.theirMessageTime,
          ]}
        >
          {new Date(item.created_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  const getOtherUserInfo = () => {
    if (!contact || !userId) return null;
    
    const isProfessional = contact.professional_id === userId;
    
    return {
      name: isProfessional ? contact.client_name : contact.professional_name,
      id: isProfessional ? contact.client_id : contact.professional_id,
      role: isProfessional ? 'Cliente' : 'Profissional',
    };
  };

  const otherUser = getOtherUserInfo();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat</Text>
          <View style={styles.closeButton} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {otherUser && (
              <ProfileCard
                name={otherUser.name || 'Usuário'}
                role={otherUser.role}
              />
            )}

            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }}
            />

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={0}
            >
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Digite sua mensagem..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={1000}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!inputText.trim() || sending) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.sendButtonText}>➤</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: colors.text,
  },
  messageTime: {
    fontSize: 11,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  theirMessageTime: {
    color: colors.textSecondary,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 16,
    color: colors.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
