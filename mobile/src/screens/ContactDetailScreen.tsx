import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, IconButton, Snackbar } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  getContactDetails,
  sendContactMessage,
  markContactMessagesAsRead,
  Contact,
  ChatMessage,
} from '../api/contacts';
import { getProject, Project, evaluateProject } from '../api/projects';
import useAuthStore from '../stores/authStore';
import { createWebsocket } from '../services/websocket';
import EvaluationModal from '../components/EvaluationModal';

interface Params {
  contactId: string;
}

export default function ContactDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as Params;
  const contactId = params?.contactId;

  const [contact, setContact] = useState<Contact | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [messageText, setMessageText] = useState<string>('');
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [evaluationVisible, setEvaluationVisible] = useState<boolean>(false);
  const [snackbarVisible, setSnackbarVisible] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [hasEvaluated, setHasEvaluated] = useState<boolean>(false);

  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<any>(null);
  const hasEvaluatedRef = useRef<boolean>(false);
  const loggedSenderCheckRef = useRef<boolean>(false);


  const loadContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const contactData = await getContactDetails(contactId);
      setContact(contactData);
      setMessages(contactData.chat || []);

      // Mark messages as read
      try {
        await markContactMessagesAsRead(contactId);
      } catch (e) {
        console.warn('[ContactDetail] failed to mark messages as read', e);
      }

      // Load project details
      try {
        const projectData = await getProject(contactData.project_id);
        setProject(projectData);

        // Check if project is closed and prompt for evaluation
        if (projectData.status === 'closed' && !hasEvaluatedRef.current) {
          // Give user a moment to see the closed status
          setTimeout(() => {
            setEvaluationVisible(true);
          }, 1500);
        }
      } catch (e) {
        console.warn('[ContactDetail] failed to load project', e);
      }
    } catch (e) {
      console.error('[ContactDetail] failed to load contact', e);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [contactId, navigation]);

  useEffect(() => {
    if (!contactId) {
      navigation.goBack();
      return;
    }
    loadContact();
  }, [contactId, navigation, loadContact]);

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    if (!user?.id) return;

    try {
      const ws = createWebsocket(user.id);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        console.log('[ContactDetail] WebSocket connected');
        setWsConnected(true);
      });

      ws.addEventListener('close', () => {
        console.log('[ContactDetail] WebSocket closed');
        setWsConnected(false);
      });

      ws.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[ContactDetail] WebSocket message:', data);

          if (data.type === 'new_message' && data.contact_id === contactId) {
            // Recarrega do servidor para garantir sender_id correto
            // Evita duplicatas e formato mismatch entre temp e WS
            getContactDetails(contactId)
              .then((updated) => {
                setMessages(updated.chat || []);
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
              })
              .catch(() => {
                // Fallback: adiciona a mensagem diretamente se reload falhar
                const msg = data.message;
                if (!msg) return;
                const newMessage: ChatMessage = msg;
                setMessages((prev) => {
                  const exists = prev.some((m) => m.id === newMessage.id);
                  if (exists) return prev;
                  return [...prev, newMessage];
                });
              });
          } else if (data.type === 'messages_read' && data.contact_id === contactId) {
            // The other side read our messages — reload to update ✔ → ✔✔
            getContactDetails(contactId)
              .then((updated) => setMessages(updated.chat || []))
              .catch((e) => console.warn('[ContactDetail] failed to reload after messages_read', e));
          } else if (data.type === 'contact_update' && data.contact?.contact_id === contactId) {
            // Reload contact details (backend sends update nested under data.contact)
            loadContact();
          }
        } catch (e) {
          console.error('[ContactDetail] failed to parse WebSocket message', e);
        }
      });

      return () => {
        ws.close();
      };
    } catch (e) {
      console.error('[ContactDetail] failed to setup WebSocket', e);
    }
  }, [user?.id, contactId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending || !contactId) return;

    const textToSend = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      await sendContactMessage(contactId, textToSend);
      // Recarrega do servidor para garantir sender_id correto e evitar duplicatas com WS
      const updated = await getContactDetails(contactId);
      setMessages(updated.chat || []);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      console.error('[ContactDetail] failed to send message', e);
      setMessageText(textToSend); // Restaura texto em caso de erro
    } finally {
      setSending(false);
    }
  };

  const handleSubmitEvaluation = async (
    rating: number,
    comment: string,
    wouldRecommend: boolean
  ) => {
    if (!project?.id) return;

    try {
      await evaluateProject(project.id, { rating, comment, would_recommend: wouldRecommend });
      setEvaluationVisible(false);
      setHasEvaluated(true);
      hasEvaluatedRef.current = true;
      setSnackbarMessage('Avaliação enviada com sucesso!');
      setSnackbarVisible(true);
    } catch (e: any) {
      console.error('[ContactDetail] failed to submit evaluation', e);
      setSnackbarMessage('Erro ao enviar avaliação. Tente novamente.');
      setSnackbarVisible(true);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  };

  const getOtherName = (): string => {
    if (!contact) return 'Outro';
    return user?.id === contact.professional_id
      ? contact.client_name || 'Cliente'
      : contact.professional_name || 'Profissional';
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    // Compare directly using UUID strings (should always be UUID strings as expected).
    const userId = user?.id ?? (user as any)?._id;
    const isMyMessage = !!userId && item.sender_id === userId;

    const showDate =
      index === 0 ||
      new Date(item.created_at).toDateString() !==
        new Date(messages[index - 1].created_at).toDateString();

    // Show sender name on the first message in a group from the same sender
    const prevItem = index > 0 ? messages[index - 1] : null;
    const prevSenderId = prevItem?.sender_id;
    const showSenderName = !isMyMessage && (!prevItem || prevSenderId !== item.sender_id);

    // Usa sender_name da mensagem se disponível, senão infere do contato
    const displaySenderName = item.sender_name || getOtherName();

    return (
      <View key={item.id}>
        {showDate && (
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            ]}
          >
            {!isMyMessage && showSenderName && (
              <Text style={styles.senderName}>{displaySenderName}</Text>
            )}
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
              ]}
            >
              {item.content}
            </Text>
            <View style={styles.timeRow}>
              <Text
                style={[
                  styles.messageTime,
                  isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
                ]}
              >
                {formatTime(item.created_at)}
              </Text>
              {isMyMessage && (
                <Text
                  style={[
                    styles.readTick,
                    item.read_at ? styles.readTickRead : styles.readTickSent,
                  ]}
                >
                  
                  {item.read_at ? ' ✓✓' : ' ✓'}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Carregando conversa...</Text>
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Contato não encontrado</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      {/* WhatsApp-style header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName} numberOfLines={1}>
            {contact
              ? user?.id === contact.professional_id
                ? contact.client_name || 'Cliente'
                : contact.professional_name || 'Profissional'
              : ''}
          </Text>
          {project && (
            <Text style={styles.chatHeaderSub} numberOfLines={1}>
              {project.title}
            </Text>
          )}
        </View>
        {wsConnected && (
          <View style={styles.onlineIndicator}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>online</Text>
          </View>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
            <Text style={styles.emptyHint}>Envie uma mensagem para iniciar a conversa</Text>
          </View>
        }
        />

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Digite sua mensagem..."
          multiline
          maxLength={1000}
          disabled={sending}
          />
        <IconButton
          icon="send"
          size={24}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
          iconColor={messageText.trim() && !sending ? '#075E54' : '#9CA3AF'}
        />
      </View>

      {/* Evaluation Modal */}
      {project && (
        <EvaluationModal
          visible={evaluationVisible}
          onDismiss={() => setEvaluationVisible(false)}
          onSubmit={handleSubmitEvaluation}
          projectTitle={project.title}
        />
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ECE5DD',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#075E54',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  backIcon: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '600',
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  chatHeaderSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  onlineText: {
    fontSize: 12,
    color: '#10B981',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  myMessageBubble: {
    backgroundColor: '#DCF8C6',
    borderBottomRightRadius: 6,
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#075E54',
    marginBottom: 2,
  },
  myMessageText: {
    color: '#111827',
  },
  otherMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
  },
  myMessageTime: {
    color: '#4B5563',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#9CA3AF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  readTick: {
    fontSize: 11,
    fontWeight: '600',
  },
  readTickSent: {
    color: '#9CA3AF',
  },
  readTickRead: {
    color: '#3B82F6',
  },
});
