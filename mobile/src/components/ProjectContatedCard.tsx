import { Project, ContactSummary } from "../api/projects";
import { Text, Avatar, Badge, Button } from "react-native-paper";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import useAuthStore from "../stores/authStore";

const STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando resposta',
  in_conversation: 'Em conversa',
  accepted: 'Aceito',
  rejected: 'Rejeitado',
  completed: 'Concluído',
};

export function ProjectContactedCard({ project }: { project: Project }) {
    const navigation = useNavigation<any>();
    const { user } = useAuthStore();

    // From the professional's perspective, show only their own contact on this project
    const allContacts: ContactSummary[] = (project as any).contacts || [];
    const myContact = allContacts.find(
        (c) => c.professional_id === user?.id
    );

    const statusLabel = myContact ? (STATUS_LABELS[myContact.status] ?? myContact.status) : null;

    const handleOpenChat = () => {
        if (myContact?.id) {
            navigation.navigate('ContactDetail', { contactId: myContact.id });
        }
    };

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={handleOpenChat}
        activeOpacity={myContact?.id ? 0.7 : 1}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{project.title ?? (project as any)._id}</Text>
            {myContact && myContact.unread_count > 0 && (
              <Badge style={styles.badge}>{myContact.unread_count > 99 ? '99+' : myContact.unread_count}</Badge>
            )}
          </View>
          {statusLabel && (
            <Text style={styles.status}>{statusLabel}</Text>
          )}
          <Text style={styles.description} numberOfLines={2}>{project.description}</Text>
        </View>

        {myContact ? (
          <View style={styles.contactInfo}>
            {myContact.last_message ? (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {myContact.last_message.content}
              </Text>
            ) : (
              <Text style={styles.noMessage}>Nenhuma mensagem ainda. Envie a primeira!</Text>
            )}
            <Button
              mode="contained"
              compact
              onPress={handleOpenChat}
              style={styles.chatButton}
            >
              Abrir Conversa
            </Button>
          </View>
        ) : (
          <Text style={styles.noContact}>Você ainda não contatou este projeto.</Text>
        )}
      </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#ef4444',
  },
  status: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  contactInfo: {
    marginTop: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  noMessage: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  chatButton: {
    alignSelf: 'flex-start',
  },
  noContact: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
});




