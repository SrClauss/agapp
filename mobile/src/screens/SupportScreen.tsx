import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  TextInput,
  Divider,
  Portal,
  Dialog,
  RadioButton,
  Snackbar,
  IconButton,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import client from '../api/axiosClient';
import useAuthStore from '../stores/authStore';

interface TicketSummary {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  attendant_name?: string;
  unread_messages: number;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  sender_id: string;
  sender_type: string;
  sender_name: string;
  message: string;
  created_at: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  attendant_name?: string;
  messages: TicketMessage[];
  rating?: number;
  created_at: string;
  updated_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  waiting_user: 'Aguardando',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const STATUS_COLOR: Record<string, string> = {
  open: '#F59E0B',
  in_progress: '#3B82F6',
  waiting_user: '#8B5CF6',
  resolved: '#10B981',
  closed: '#6B7280',
};

const CATEGORY_LABEL: Record<string, string> = {
  technical: 'Técnico',
  payment: 'Pagamento',
  general: 'Geral',
  complaint: 'Reclamação',
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

type SupportView = 'list' | 'chat';

export default function SupportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [currentView, setCurrentView] = useState<SupportView>('list');
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // New ticket dialog
  const [newTicketVisible, setNewTicketVisible] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const flatListRef = useRef<FlatList>(null);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await client.get('/support/tickets/my');
      setTickets(response.data);
    } catch (e) {
      console.warn('[SupportScreen] failed to load tickets', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const openTicket = async (ticketId: string) => {
    setLoadingTicket(true);
    setCurrentView('chat');
    try {
      const response = await client.get(`/support/tickets/${ticketId}`);
      setSelectedTicket(response.data);
    } catch (e) {
      console.warn('[SupportScreen] failed to load ticket detail', e);
      setCurrentView('list');
    } finally {
      setLoadingTicket(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedTicket) return;
    setSending(true);
    const content = messageText.trim();
    setMessageText('');
    try {
      await client.post(`/support/tickets/${selectedTicket.id}/messages`, { message: content });
      // Reload ticket
      const response = await client.get(`/support/tickets/${selectedTicket.id}`);
      setSelectedTicket(response.data);
    } catch (e: any) {
      setMessageText(content);
      Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  const createTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      Alert.alert('Atenção', 'Preencha assunto e mensagem.');
      return;
    }
    setCreating(true);
    try {
      await client.post('/support/tickets', {
        subject: newSubject.trim(),
        category: newCategory,
        message: newMessage.trim(),
        priority: 'normal',
      });
      setNewTicketVisible(false);
      setNewSubject('');
      setNewCategory('general');
      setNewMessage('');
      setSnackbarMessage('Ticket criado com sucesso!');
      setSnackbarVisible(true);
      loadTickets();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Erro ao criar ticket.';
      Alert.alert('Erro', msg);
    } finally {
      setCreating(false);
    }
  };

  const renderTicketItem = ({ item }: { item: TicketSummary }) => (
    <Card style={styles.ticketCard} onPress={() => openTicket(item.id)}>
      <Card.Content>
        <View style={styles.ticketHeader}>
          <Text style={styles.ticketSubject} numberOfLines={1}>{item.subject}</Text>
          {item.unread_messages > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unread_messages}</Text>
            </View>
          )}
        </View>
        <View style={styles.ticketMeta}>
          <Chip
            compact
            style={{ backgroundColor: STATUS_COLOR[item.status] + '20' }}
            textStyle={{ color: STATUS_COLOR[item.status], fontSize: 11 }}
          >
            {STATUS_LABEL[item.status] || item.status}
          </Chip>
          <Chip compact style={styles.categoryChip} textStyle={styles.categoryText}>
            {CATEGORY_LABEL[item.category] || item.category}
          </Chip>
        </View>
        <Text style={styles.ticketDate}>{formatDate(item.updated_at)}</Text>
        {item.attendant_name && (
          <Text style={styles.attendantName}>Atendente: {item.attendant_name}</Text>
        )}
      </Card.Content>
    </Card>
  );

  const renderMessage = ({ item }: { item: TicketMessage }) => {
    const isMe = item.sender_type === 'user';
    return (
      <View style={[styles.msgContainer, isMe ? styles.msgMine : styles.msgOther]}>
        {!isMe && <Text style={styles.msgSender}>{item.sender_name}</Text>}
        <View style={[styles.msgBubble, isMe ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.msgText, isMe ? styles.msgTextMine : styles.msgTextOther]}>
            {item.message}
          </Text>
        </View>
        <Text style={styles.msgTime}>{formatDate(item.created_at)}</Text>
      </View>
    );
  };

  if (currentView === 'chat' && selectedTicket) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <IconButton
            icon="arrow-left"
            onPress={() => {
              setCurrentView('list');
              setSelectedTicket(null);
            }}
          />
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatSubject} numberOfLines={1}>{selectedTicket.subject}</Text>
            <Chip
              compact
              style={{ backgroundColor: STATUS_COLOR[selectedTicket.status] + '20' }}
              textStyle={{ color: STATUS_COLOR[selectedTicket.status], fontSize: 11 }}
            >
              {STATUS_LABEL[selectedTicket.status] || selectedTicket.status}
            </Chip>
          </View>
        </View>

        {loadingTicket ? (
          <ActivityIndicator style={styles.centered} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={selectedTicket.messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
              </View>
            }
          />
        )}

        {/* Input */}
        {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Escreva sua mensagem..."
              multiline
              maxLength={2000}
              disabled={sending}
            />
            <IconButton
              icon="send"
              size={24}
              onPress={sendMessage}
              disabled={!messageText.trim() || sending}
              iconColor={messageText.trim() && !sending ? colors.primary : '#9CA3AF'}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tickets List */}
      {loading ? (
        <ActivityIndicator style={styles.centered} size="large" />
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderTicketItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Meus Tickets</Text>
              <Button
                mode="contained"
                onPress={() => setNewTicketVisible(true)}
                icon="plus"
                style={styles.newTicketButton}
              >
                Novo Ticket
              </Button>
            </View>
          }
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Card.Content>
                <Text style={styles.emptyText}>Nenhum ticket de suporte encontrado.</Text>
                <Text style={styles.emptyHint}>
                  Abra um novo ticket para falar com nossa equipe.
                </Text>
              </Card.Content>
            </Card>
          }
        />
      )}

      {/* New Ticket Dialog */}
      <Portal>
        <Dialog visible={newTicketVisible} onDismiss={() => setNewTicketVisible(false)}>
          <Dialog.Title>Abrir Novo Ticket</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <TextInput
                label="Assunto"
                value={newSubject}
                onChangeText={setNewSubject}
                maxLength={200}
                mode="outlined"
                style={styles.dialogInput}
                disabled={creating}
              />

              <Text style={styles.dialogLabel}>Categoria</Text>
              <RadioButton.Group value={newCategory} onValueChange={setNewCategory}>
                <View style={styles.radioRow}>
                  <RadioButton value="general" /><Text>Geral</Text>
                </View>
                <View style={styles.radioRow}>
                  <RadioButton value="technical" /><Text>Técnico</Text>
                </View>
                <View style={styles.radioRow}>
                  <RadioButton value="payment" /><Text>Pagamento</Text>
                </View>
                <View style={styles.radioRow}>
                  <RadioButton value="complaint" /><Text>Reclamação</Text>
                </View>
              </RadioButton.Group>

              <TextInput
                label="Mensagem"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                numberOfLines={4}
                maxLength={5000}
                mode="outlined"
                style={styles.dialogInput}
                disabled={creating}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setNewTicketVisible(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={createTicket}
              loading={creating}
              disabled={creating || !newSubject.trim() || !newMessage.trim()}
            >
              Criar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{ label: 'OK', onPress: () => setSnackbarVisible(false) }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  listContent: { padding: 16, paddingBottom: 32 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  listTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  newTicketButton: { borderRadius: 8 },
  ticketCard: { borderRadius: 12, marginBottom: 10, elevation: 1 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ticketSubject: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  unreadBadge: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  unreadCount: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  ticketMeta: { flexDirection: 'row', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  categoryChip: { backgroundColor: '#F3F4F6' },
  categoryText: { color: '#374151', fontSize: 11 },
  ticketDate: { fontSize: 12, color: '#9CA3AF' },
  attendantName: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  emptyCard: { borderRadius: 12, elevation: 1 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 4 },
  emptyHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  // Chat styles
  chatHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingRight: 12 },
  chatHeaderInfo: { flex: 1 },
  chatSubject: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  messagesList: { padding: 16, flexGrow: 1 },
  msgContainer: { marginVertical: 4, maxWidth: '80%' },
  msgMine: { alignSelf: 'flex-end' },
  msgOther: { alignSelf: 'flex-start' },
  msgSender: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  msgBubble: { borderRadius: 16, padding: 12 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, elevation: 1 },
  msgText: { fontSize: 14 },
  msgTextMine: { color: '#FFFFFF' },
  msgTextOther: { color: '#111827' },
  msgTime: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  input: { flex: 1, maxHeight: 100, marginRight: 8, backgroundColor: '#F3F4F6' },
  dialogContent: { paddingHorizontal: 8 },
  dialogInput: { marginBottom: 16, backgroundColor: '#FFFFFF' },
  dialogLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  radioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
});
