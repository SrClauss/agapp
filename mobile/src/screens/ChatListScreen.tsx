import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Text, Avatar, Badge, Searchbar, Divider } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getContactHistory, Contact } from '../api/contacts';
import useAuthStore from '../stores/authStore';
import { colors } from '../theme/colors';
import LocationAvatar from '../components/LocationAvatar';

interface ChatItemData {
  contactId: string;
  projectId: string;
  otherUserName: string;
  otherUserId: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  projectTitle: string;
}

export default function ChatListScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { loadUnreadCount } = useChatStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadContacts = async () => {
    if (!user) return;

    try {
      const userType = user.roles.includes('professional') ? 'professional' : 'client';
      const data = await getContactHistory(userType);
      setContacts(data);
      
      // Also reload unread count
      await loadUnreadCount();
    } catch (error) {
      console.error('[ChatListScreen] Failed to load contacts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [user]);

  // Reload when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadContacts();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadContacts();
  };

  const getChatItems = (): ChatItemData[] => {
    if (!user) return [];

    return contacts.map((contact) => {
      const isProfessional = user.roles.includes('professional');
      const otherUserName = isProfessional
        ? contact.client_name || 'Cliente'
        : contact.professional_name || 'Profissional';
      const otherUserId = isProfessional ? contact.client_id : contact.professional_id;

      const chat = contact.chat || [];
      const lastMessage = chat.length > 0 ? chat[chat.length - 1] : null;
      
      // Count unread messages (messages from other user that haven't been read)
      const unreadCount = chat.filter(
        (msg) => msg.sender_id !== user.id && !msg.read
      ).length;

      return {
        contactId: contact.id,
        projectId: contact.project_id,
        otherUserName,
        otherUserId,
        lastMessage: lastMessage?.content,
        lastMessageTime: lastMessage?.created_at,
        unreadCount,
        projectTitle: (contact as any).project_title || 'Projeto',
      };
    });
  };

  const filteredChats = getChatItems().filter((chat) =>
    chat.otherUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.projectTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderChatItem = ({ item }: { item: ChatItemData }) => {
    const initials = item.otherUserName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const formatTime = (timestamp?: string) => {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Agora';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('ContactDetail' as never, { contactId: item.contactId } as never)}
      >
        <Avatar.Text size={48} label={initials} style={styles.avatar} />
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>
              {item.otherUserName}
            </Text>
            {item.lastMessageTime && (
              <Text style={styles.chatTime}>{formatTime(item.lastMessageTime)}</Text>
            )}
          </View>
          <Text style={styles.projectTitle} numberOfLines={1}>
            {item.projectTitle}
          </Text>
          {item.lastMessage && (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          )}
        </View>
        {item.unreadCount > 0 && (
          <Badge style={styles.badge}>{item.unreadCount}</Badge>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LocationAvatar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LocationAvatar />
      
      <View style={styles.content}>
        <Text style={styles.title}>Conversas</Text>
        
        <Searchbar
          placeholder="Buscar conversas..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        {filteredChats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Nenhuma conversa encontrada'
                : 'Você ainda não tem conversas'}
            </Text>
            {!searchQuery && (
              <Text style={styles.emptyHint}>
                Quando você entrar em contato com um projeto, a conversa aparecerá aqui.
              </Text>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredChats}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.contactId}
            ItemSeparatorComponent={() => <Divider />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: colors.text,
  },
  searchBar: {
    marginBottom: 16,
    elevation: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: colors.primary,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  chatTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  projectTitle: {
    fontSize: 13,
    color: colors.primary,
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  badge: {
    backgroundColor: '#ff3b30',
    color: '#fff',
    marginLeft: 8,
  },
});
