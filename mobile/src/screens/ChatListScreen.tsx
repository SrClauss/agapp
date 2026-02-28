import React, { useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Avatar, Badge, Divider } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getContactHistory, Contact } from '../api/contacts';
import useAuthStore from '../stores/authStore';
import { colors } from '../theme/colors';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function ChatListScreen() {
  const navigation = useNavigation();
  const { activeRole } = useAuthStore();
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userType = activeRole === 'professional' ? 'professional' : 'client';
      const data = await getContactHistory(userType);
      setContacts(data);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  }, [activeRole]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={contacts}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <Divider />}
      contentContainerStyle={contacts.length === 0 ? styles.emptyContainer : undefined}
      ListEmptyComponent={() => (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Nenhuma conversa encontrada.</Text>
        </View>
      )}
      renderItem={({ item }) => {
        const lastMsg = item.chat && item.chat.length > 0 ? item.chat[item.chat.length - 1] : null;
        const unreadCount: number = item.unread_count || 0;
        const otherName =
          activeRole === 'professional'
            ? (item.client_name || 'Cliente')
            : (item.professional_name || 'Profissional');
        const initials = otherName
          .split(' ')
          .slice(0, 2)
          .map((w: string) => w[0])
          .join('')
          .toUpperCase();

        return (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('ContactDetail', { contactId: item.id })}
            activeOpacity={0.7}
          >
            <View style={styles.avatarWrapper}>
              <Avatar.Text size={48} label={initials} style={styles.avatar} />
              {unreadCount > 0 && (
                <Badge style={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</Badge>
              )}
            </View>
            <View style={styles.content}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>{otherName}</Text>
                {lastMsg && (
                  <Text style={styles.time}>{formatDate(lastMsg.created_at)}</Text>
                )}
              </View>
              <Text
                style={[styles.preview, unreadCount > 0 && styles.previewUnread]}
                numberOfLines={1}
              >
                {lastMsg ? lastMsg.content : 'Nenhuma mensagem ainda'}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyContainer: { flexGrow: 1 },
  emptyText: { color: '#888', fontSize: 16 },
  errorText: { color: 'red', fontSize: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  avatarWrapper: { position: 'relative', marginRight: 12 },
  avatar: { backgroundColor: colors.primary },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.secondary,
  },
  content: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  time: { fontSize: 12, color: '#888' },
  preview: { fontSize: 14, color: '#666', marginTop: 2 },
  previewUnread: { color: '#333', fontWeight: '600' },
});
