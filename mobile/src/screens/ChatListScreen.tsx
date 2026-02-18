import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { Text, Card, Avatar, Badge, ActivityIndicator, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getContactHistory } from '../api/contacts';
import useAuthStore from '../stores/authStore';
import { colors } from '../theme/colors';

interface Contact {
  id: string;
  project_id: string;
  project_title: string;
  professional_id: string;
  professional_name?: string;
  client_id: string;
  client_name?: string;
  contact_type: string;
  status: string;
  chat: any[];
  created_at: string;
  updated_at: string;
  unread_count: number;
}

export default function ChatListScreen() {
  const navigation = useNavigation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const user = useAuthStore((s) => s.user);
  const userType = user?.roles?.includes('professional') ? 'professional' : 'client';

  const loadContacts = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const data = await getContactHistory(userType);
      setContacts(data);
      setFilteredContacts(data);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userType]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContacts(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
  );

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = contacts.filter((contact) => {
        const otherName = userType === 'professional' ? contact.client_name : contact.professional_name;
        const projectTitle = contact.project_title || '';
        return (
          otherName?.toLowerCase().includes(query) ||
          projectTitle.toLowerCase().includes(query)
        );
      });
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts, userType]);

  const renderContact = ({ item }: { item: Contact }) => {
    const otherName = userType === 'professional' ? item.client_name : item.professional_name;
    const lastMessage = item.chat && item.chat.length > 0 ? item.chat[item.chat.length - 1] : null;
    const lastMessagePreview = lastMessage ? lastMessage.content : 'Sem mensagens';

    return (
      <Card
        style={styles.card}
        onPress={() => {
          navigation.navigate('ContactDetail', { contactId: item.id });
        }}
      >
        <Card.Title
          title={otherName || 'Sem nome'}
          subtitle={item.project_title || 'Projeto'}
          left={(props) => (
            <Avatar.Icon {...props} icon="account-circle" size={48} />
          )}
          right={(props) =>
            item.unread_count > 0 ? (
              <Badge size={24} style={styles.badge}>
                {item.unread_count}
              </Badge>
            ) : null
          }
        />
        <Card.Content>
          <Text numberOfLines={2} style={styles.lastMessage}>
            {lastMessagePreview}
          </Text>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <Text variant="headlineSmall" style={styles.title}>
          Conversas
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conversas..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredContacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: colors.primary,
  },
  title: {
    flex: 1,
    color: '#fff',
    marginLeft: 8,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  badge: {
    backgroundColor: colors.error,
    marginRight: 16,
  },
  lastMessage: {
    color: '#666',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
});
