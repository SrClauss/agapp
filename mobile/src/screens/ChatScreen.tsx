import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Text, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { getContactDetails, sendContactMessage, Contact, ChatMessage } from '../api/contacts';
import { useAuthStore } from '../stores/authStore';

type ChatScreenRouteProp = RouteProp<{ params: { contactId: string } }, 'params'>;

export default function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const { contactId } = route.params;
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadContact();
    // Set up polling or WebSocket for real-time updates
    const interval = setInterval(loadContact, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [contactId]);

  const loadContact = async () => {
    try {
      const data = await getContactDetails(contactId);
      setContact(data);
      setMessages(data.chat || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading contact:', error);
      Alert.alert('Erro', 'Falha ao carregar conversa');
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      setSending(true);
      const content = messageText.trim();
      setMessageText('');

      await sendContactMessage(contactId, content);
      
      // Reload contact to get updated messages
      await loadContact();
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Erro', 'Falha ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const isMyMessage = (message: ChatMessage) => {
    return message.sender_id === user?.id;
  };

  const getOtherUserName = () => {
    if (!contact || !user) return '';
    return user.id === contact.professional_id
      ? contact.client_name || 'Cliente'
      : contact.professional_name || 'Profissional';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando conversa...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!contact) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text>Conversa não encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{getOtherUserName()}</Text>
          <Text style={styles.headerSubtitle}>
            Status: {contact.status}
          </Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
              <Text style={styles.emptySubtext}>Envie uma mensagem para iniciar a conversa</Text>
            </View>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  isMyMessage(message) ? styles.myMessage : styles.otherMessage,
                ]}
              >
                <Text 
                  style={[
                    styles.messageText,
                    { color: isMyMessage(message) ? '#FFFFFF' : colors.text }
                  ]}
                >
                  {message.content}
                </Text>
                <Text 
                  style={[
                    styles.messageTime,
                    { color: isMyMessage(message) ? '#FFFFFF' : colors.textSecondary }
                  ]}
                >
                  {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            mode="outlined"
            placeholder="Digite sua mensagem..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
            disabled={sending}
          />
          <IconButton
            icon="send"
            size={24}
            iconColor={colors.primary}
            disabled={!messageText.trim() || sending}
            onPress={handleSendMessage}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  messagesContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: 15,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 11,
    textAlign: 'right',
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    marginRight: 8,
    maxHeight: 100,
  },
});
