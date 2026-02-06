import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Text, TextInput, IconButton, Divider, Card, Snackbar } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  getContactDetails,
  sendContactMessage,
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

  useEffect(() => {
    if (!contactId) {
      navigation.goBack();
      return;
    }

    const loadContact = async () => {
      setLoading(true);
      try {
        const contactData = await getContactDetails(contactId);
        setContact(contactData);
        setMessages(contactData.chat || []);

        // Load project details
        try {
          const projectData = await getProject(contactData.project_id);
          setProject(projectData);

          // Check if project is closed and prompt for evaluation
          if (projectData.status === 'closed' && !hasEvaluated) {
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
    };

    loadContact();
  }, [contactId, navigation, hasEvaluated]);

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
            // Add new message to chat
            const newMessage: ChatMessage = {
              id: data.message_id,
              sender_id: data.sender_id,
              content: data.content,
              created_at: data.created_at || new Date().toISOString(),
            };
            setMessages((prev) => [...prev, newMessage]);
          } else if (data.type === 'contact_update' && data.contact_id === contactId) {
            // Reload contact details
            getContactDetails(contactId)
              .then((updated) => {
                setContact(updated);
                setMessages(updated.chat || []);
              })
              .catch((e) => console.warn('[ContactDetail] failed to reload contact', e));
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

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender_id: user?.id || '',
      content: messageText.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setMessageText('');
    setSending(true);

    try {
      await sendContactMessage(contactId, tempMessage.content);
      // Message will be updated via WebSocket or on reload
    } catch (e: any) {
      console.error('[ContactDetail] failed to send message', e);
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      setMessageText(tempMessage.content);
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

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMyMessage = item.sender_id === user?.id;
    const showDate =
      index === 0 ||
      new Date(item.created_at).toDateString() !==
        new Date(messages[index - 1].created_at).toDateString();

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
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
              ]}
            >
              {item.content}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
              ]}
            >
              {formatTime(item.created_at)}
            </Text>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Project Info Header */}
      {project && (
        <Card style={styles.projectCard}>
          <Card.Content style={styles.projectCardContent}>
            <View>
              <Text variant="titleSmall" style={styles.projectTitle}>
                {project.title}
              </Text>
              <Text variant="bodySmall" style={styles.projectStatus}>
                Status: {contact.status} • {contact.credits_used} créditos gastos
              </Text>
            </View>
            {wsConnected && (
              <View style={styles.onlineIndicator}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
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
          iconColor={messageText.trim() && !sending ? '#3B82F6' : '#9CA3AF'}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  projectCard: {
    margin: 0,
    borderRadius: 0,
    elevation: 2,
  },
  projectCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  projectTitle: {
    fontWeight: '600',
    color: '#111827',
  },
  projectStatus: {
    marginTop: 4,
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
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  myMessageBubble: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
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
});
