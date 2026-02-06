import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Avatar, Badge, Card } from 'react-native-paper';
import { ContactSummary } from '../api/projects';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  contacts: ContactSummary[];
  onContactPress: (contactId: string) => void;
}

export default function ProjectContactsList({ contacts, onContactPress }: Props) {
  const renderContact = ({ item }: { item: ContactSummary }) => (
    <TouchableOpacity onPress={() => onContactPress(item.id)}>
      <Card style={styles.card}>
        <View style={styles.row}>
          {item.professional_avatar ? (
            <Avatar.Image 
              size={48} 
              source={{ uri: item.professional_avatar }} 
            />
          ) : (
            <Avatar.Icon size={48} icon="account" />
          )}
          <View style={styles.info}>
            <View style={styles.header}>
              <Text style={styles.name}>{item.professional_name}</Text>
              {item.unread_count > 0 && (
                <Badge size={20}>{item.unread_count}</Badge>
              )}
            </View>
            <Text style={styles.status}>{getStatusLabel(item.status)}</Text>
            {item.last_message && (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.last_message.content}
              </Text>
            )}
            {item.contact_details.proposal_price && (
              <Text style={styles.price}>
                Proposta: R$ {item.contact_details.proposal_price.toFixed(2)}
              </Text>
            )}
            <Text style={styles.time}>
              {formatDistanceToNow(new Date(item.created_at), { 
                addSuffix: true, 
                locale: ptBR 
              })}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={contacts}
      keyExtractor={(item) => item.id}
      renderItem={renderContact}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text>Nenhum profissional entrou em contato ainda.</Text>
        </View>
      }
    />
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Aguardando resposta',
    in_conversation: 'Em conversa',
    accepted: 'Aceito',
    rejected: 'Rejeitado',
    completed: 'Concluído'
  };
  return labels[status] || status;
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, marginLeft: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: 'bold' },
  status: { fontSize: 12, color: '#666', marginTop: 2 },
  lastMessage: { fontSize: 14, marginTop: 4, color: '#333' },
  price: { fontSize: 13, marginTop: 2, color: '#2196F3', fontWeight: '600' },
  time: { fontSize: 12, color: '#999', marginTop: 4 },
  empty: { padding: 32, alignItems: 'center' }
});
