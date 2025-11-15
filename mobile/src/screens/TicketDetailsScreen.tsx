import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Text, TextInput, IconButton, ActivityIndicator, Card } from 'react-native-paper';
import { useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, typography, shadows } from '../theme';
import apiService from '../services/api';
import websocketService from '../services/websocket';

type RouteParams = {
  TicketDetails: {
    ticketId: string;
  };
};

type TicketDetailsScreenRouteProp = RouteProp<RouteParams, 'TicketDetails'>;

interface Message {
  id: string;
  sender_id: string;
  sender_type: string;
  sender_name: string;
  message: string;
  created_at: string;
  read_at?: string;
}

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  attendant_id?: string;
  attendant_name?: string;
  messages: Message[];
  rating?: number;
  rating_comment?: string;
  created_at: string;
  updated_at: string;
}

const TicketDetailsScreen = () => {
  const route = useRoute<TicketDetailsScreenRouteProp>();
  const { ticketId } = route.params;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadTicket();
    setupWebSocket();

    return () => {
      websocketService.removeMessageListener(handleWebSocketMessage);
    };
  }, [ticketId]);

  const loadTicket = async () => {
    try {
      const token = await apiService.getToken();
      if (!token) {
        throw new Error('Não autenticado');
      }

      const data = await apiService.getTicket(token, ticketId);
      setTicket(data);
    } catch (error: any) {
      console.error('Erro ao carregar ticket:', error);
      Alert.alert('Erro', 'Não foi possível carregar o ticket');
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = async () => {
    try {
      const token = await apiService.getToken();
      const userId = await apiService.getUserId();

      if (!token || !userId) return;

      await websocketService.connect(userId, token);
      websocketService.addMessageListener(handleWebSocketMessage);
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
    }
  };

  const handleWebSocketMessage = (data: any) => {
    if (data.type === 'support_message' && data.ticket_id === ticketId) {
      // Adiciona nova mensagem ao ticket
      setTicket((prev) => {
        if (!prev) return prev;

        const messageExists = prev.messages.some((m) => m.id === data.message.id);
        if (messageExists) return prev;

        return {
          ...prev,
          messages: [...prev.messages, data.message],
        };
      });

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !ticket) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      // Envia via WebSocket se conectado
      if (websocketService.isConnected()) {
        websocketService.sendSupportMessage(ticketId, text);
      } else {
        // Fallback: envia via HTTP
        const token = await apiService.getToken();
        if (!token) throw new Error('Não autenticado');

        await apiService.addMessageToTicket(token, ticketId, {
          message: text,
          attachments: [],
        });

        // Recarrega ticket para ver nova mensagem
        await loadTicket();
      }

      scrollViewRef.current?.scrollToEnd({ animated: true });
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      Alert.alert('Erro', 'Não foi possível enviar a mensagem');
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000 / 60;

    if (diff < 1) return 'Agora';
    if (diff < 60) return `${Math.floor(diff)}m atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      open: 'Aberto',
      in_progress: 'Em Progresso',
      waiting_user: 'Aguardando Resposta',
      resolved: 'Resolvido',
      closed: 'Fechado',
    };
    return statusMap[status] || status;
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: Record<string, string> = {
      technical: 'Técnico',
      payment: 'Pagamento',
      general: 'Geral',
      complaint: 'Reclamação',
    };
    return categoryMap[category] || category;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando conversa...</Text>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Ticket não encontrado</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.subject}>{ticket.subject}</Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {getCategoryLabel(ticket.category)} • {getStatusLabel(ticket.status)}
          </Text>
        </View>
        {ticket.attendant_name && (
          <Text style={styles.attendantText}>
            Atendente: {ticket.attendant_name}
          </Text>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {ticket.messages.map((message, index) => {
          const isUser = message.sender_type === 'user';
          const isFirstInGroup =
            index === 0 ||
            ticket.messages[index - 1].sender_type !== message.sender_type;

          return (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                isUser ? styles.messageWrapperUser : styles.messageWrapperAttendant,
              ]}
            >
              {isFirstInGroup && (
                <Text
                  style={[
                    styles.senderName,
                    isUser
                      ? styles.senderNameUser
                      : styles.senderNameAttendant,
                  ]}
                >
                  {message.sender_name}
                </Text>
              )}

              <View
                style={[
                  styles.messageBubble,
                  isUser ? styles.messageBubbleUser : styles.messageBubbleAttendant,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    isUser
                      ? styles.messageTextUser
                      : styles.messageTextAttendant,
                  ]}
                >
                  {message.message}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    isUser ? styles.messageTimeUser : styles.messageTimeAttendant,
                  ]}
                >
                  {formatDate(message.created_at)}
                </Text>
              </View>
            </View>
          );
        })}

        {ticket.status === 'resolved' || ticket.status === 'closed' ? (
          <Card style={styles.closedNotice}>
            <Text style={styles.closedNoticeText}>
              {ticket.status === 'resolved'
                ? '✓ Este ticket foi marcado como resolvido'
                : '✓ Este ticket foi fechado'}
            </Text>
          </Card>
        ) : null}
      </ScrollView>

      {ticket.status !== 'closed' && (
        <View style={styles.inputContainer}>
          <TextInput
            mode="outlined"
            placeholder="Digite sua mensagem..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={5000}
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            disabled={sending}
          />
          <IconButton
            icon="send"
            size={24}
            iconColor={messageText.trim() ? colors.primary : colors.textSecondary}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
            style={styles.sendButton}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error,
  },
  header: {
    backgroundColor: colors.surface,
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subject: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  meta: {
    marginBottom: spacing.xs,
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  attendantText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  messagesContent: {
    padding: spacing.base,
  },
  messageWrapper: {
    marginBottom: spacing.md,
  },
  messageWrapperUser: {
    alignItems: 'flex-end',
  },
  messageWrapperAttendant: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  senderNameUser: {
    color: colors.primary,
    textAlign: 'right',
  },
  senderNameAttendant: {
    color: colors.textSecondary,
    textAlign: 'left',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  messageBubbleUser: {
    backgroundColor: colors.primary,
  },
  messageBubbleAttendant: {
    backgroundColor: colors.surface,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  messageTextUser: {
    color: colors.surface,
  },
  messageTextAttendant: {
    color: colors.textPrimary,
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
  },
  messageTimeUser: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageTimeAttendant: {
    color: colors.textSecondary,
  },
  closedNotice: {
    backgroundColor: colors.successLight,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderRadius: spacing.sm,
  },
  closedNoticeText: {
    fontSize: typography.fontSize.sm,
    color: colors.success,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.surface,
  },
  sendButton: {
    margin: 0,
  },
});

export default TicketDetailsScreen;
