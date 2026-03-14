import React from 'react';
import { Project, ContactSummary } from '../api/projects';
import { Text, Avatar, Badge } from 'react-native-paper';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import useAuthStore from '../stores/authStore';
import { colors } from '../theme/colors';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:          { label: 'Aguardando',    color: '#92400e', bg: '#fef3c7' },
  in_conversation:  { label: 'Em conversa',   color: '#065f46', bg: '#d1fae5' },
  accepted:         { label: 'Aceito',         color: '#1e40af', bg: '#dbeafe' },
  rejected:         { label: 'Rejeitado',      color: '#991b1b', bg: '#fee2e2' },
  completed:        { label: 'Concluído',      color: '#5b21b6', bg: '#ede9fe' },
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays}d atrás`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function ProjectContactedCard({ project }: { project: Project }) {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // Extract the professional's own contact from the project's contacts array
  const allContacts: ContactSummary[] = (project as any).contacts || [];
  const myContact = allContacts.find((c) => c.professional_id === user?.id);
  const contact = myContact || allContacts[0]; // fallback: first contact in project

  // Normalize contact id (backend may return _id or contact_id instead of id)
  const contactId: string | undefined =
    (contact as any)?.id || (contact as any)?._id || (contact as any)?.contact_id;

  const statusCfg = myContact ? STATUS_CONFIG[myContact.status] : null;
  const clientName = (project as any).client_name || 'Cliente';
  const clientInitials = clientName
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  const handlePress = () => {
    // Redireciona para a tela de detalhes do projeto (rota usada para profissionais)
    const pid = (project as any).id || (project as any)._id;
    const contacts: ContactSummary[] = (project as any).contacts || [];
    const myContact = contacts.find((c) => c.professional_id === (user?.id || ''));
    const contactId = myContact?.id || (myContact as any)?._id || (myContact as any)?.contact_id;

    if (pid) {
      (navigation as any).navigate('ProjectProfessionalsDetail', { projectId: pid, project, contactId });
    }
  };

  const lastMsg = (contact as any)?.last_message;
  const unread = (contact as any)?.unread_count || 0;
  const dateStr = lastMsg?.created_at || (contact as any)?.created_at || project.created_at;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Avatar + Main content */}
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          <Avatar.Text
            size={50}
            label={clientInitials}
            style={styles.avatar}
            labelStyle={styles.avatarLabel}
          />
          {unread > 0 && (
            <Badge style={styles.unreadBadge} size={20}>
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </View>

        <View style={styles.body}>
          {/* Top row: project title + date */}
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={1}>
              {project.title || (project as any)._id}
            </Text>
            {dateStr && (
              <Text style={styles.time}>{formatRelativeDate(dateStr)}</Text>
            )}
          </View>

          {/* Client name */}
          <Text style={styles.clientName} numberOfLines={1}>
            {clientName} 
          </Text>

          {/* Último evento / resumo */}
          <View style={styles.previewRow}>
            <View style={styles.previewIconWrap}>
              <MaterialCommunityIcons
                name={lastMsg ? 'file-document-outline' : 'information-outline'}
                size={14}
                color={unread > 0 ? colors.primary : '#6b7280'}
              />
            </View>
            <Text
              style={[styles.preview, unread > 0 && styles.previewUnread]}
              numberOfLines={1}
            >
              {lastMsg ? lastMsg.content : 'Toque para ver detalhes do projeto'}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <MaterialCommunityIcons name="chevron-right" size={22} color="#d1d5db" />
      </View>

      {/* Status chip */}
      {statusCfg && (
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.chipText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    backgroundColor: colors.primary,
  },
  avatarLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    fontWeight: '700',
  },
  body: {
    flex: 1,
    marginRight: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: '#9ca3af',
  },
  clientName: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatIcon: {
    marginRight: 8,
  },
  preview: {
    fontSize: 14,
    color: '#4b5563',
    flex: 1,
  },
  previewUnread: {
    color: '#111827',
    fontWeight: '600',
  },
  previewIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chipRow: {
    marginTop: 10,
    marginLeft: 64,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});




