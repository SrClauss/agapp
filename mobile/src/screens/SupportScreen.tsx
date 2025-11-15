import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Text, FAB, Card, Badge, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, typography, shadows } from '../theme';
import apiService from '../services/api';

interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  attendant_name?: string;
  messages: Array<{
    id: string;
    sender_type: string;
    message: string;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

const SupportScreen = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTickets = async () => {
    try {
      const token = await apiService.getToken();
      if (!token) {
        throw new Error('Não autenticado');
      }

      const data = await apiService.getMyTickets(token);
      setTickets(data);
    } catch (error: any) {
      console.error('Erro ao carregar tickets:', error);
      Alert.alert('Erro', 'Não foi possível carregar os tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadTickets();
  };

  const handleTicketPress = (ticketId: string) => {
    navigation.navigate('TicketDetails', { ticketId });
  };

  const handleCreateTicket = () => {
    navigation.navigate('CreateTicket');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000 / 60;

    if (diff < 1) return 'Agora';
    if (diff < 60) return `${Math.floor(diff)}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    if (diff < 10080) return `${Math.floor(diff / 1440)}d`;

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      open: { label: 'Aberto', color: colors.success },
      in_progress: { label: 'Em Progresso', color: colors.warning },
      waiting_user: { label: 'Aguardando', color: colors.info },
      resolved: { label: 'Resolvido', color: colors.textSecondary },
      closed: { label: 'Fechado', color: colors.textSecondary },
    };

    return statusMap[status] || { label: status, color: colors.textSecondary };
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { label: string; color: string }> = {
      low: { label: 'Baixa', color: colors.info },
      normal: { label: 'Normal', color: colors.primary },
      high: { label: 'Alta', color: colors.warning },
      urgent: { label: 'Urgente', color: colors.error },
    };

    return priorityMap[priority] || { label: priority, color: colors.textSecondary };
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
        <Text style={styles.loadingText}>Carregando tickets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Suporte</Text>
          <Text style={styles.subtitle}>
            {tickets.length === 0
              ? 'Nenhum ticket criado'
              : `${tickets.length} ticket${tickets.length > 1 ? 's' : ''}`}
          </Text>
        </View>

        {tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>Nenhum ticket</Text>
            <Text style={styles.emptyText}>
              Você ainda não criou nenhum ticket de suporte.{'\n'}
              Toque no botão + para criar um.
            </Text>
          </View>
        ) : (
          <View style={styles.ticketList}>
            {tickets.map((ticket) => {
              const status = getStatusBadge(ticket.status);
              const priority = getPriorityBadge(ticket.priority);
              const lastMessage =
                ticket.messages[ticket.messages.length - 1]?.message || '';

              return (
                <TouchableOpacity
                  key={ticket.id}
                  onPress={() => handleTicketPress(ticket.id)}
                  activeOpacity={0.7}
                >
                  <Card style={styles.ticketCard}>
                    <View style={styles.ticketHeader}>
                      <View style={styles.ticketHeaderLeft}>
                        <Text style={styles.ticketSubject} numberOfLines={1}>
                          {ticket.subject}
                        </Text>
                        <Text style={styles.ticketCategory}>
                          {getCategoryLabel(ticket.category)}
                        </Text>
                      </View>
                      <Text style={styles.ticketTime}>
                        {formatDate(ticket.updated_at)}
                      </Text>
                    </View>

                    <Text style={styles.ticketPreview} numberOfLines={2}>
                      {lastMessage}
                    </Text>

                    <View style={styles.ticketFooter}>
                      <View style={styles.badges}>
                        <Badge
                          style={[styles.badge, { backgroundColor: status.color }]}
                        >
                          {status.label}
                        </Badge>
                        <Badge
                          style={[
                            styles.badge,
                            { backgroundColor: priority.color },
                          ]}
                        >
                          {priority.label}
                        </Badge>
                      </View>

                      {ticket.attendant_name && (
                        <Text style={styles.attendantName}>
                          {ticket.attendant_name}
                        </Text>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={handleCreateTicket}
        color={colors.surface}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
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
  header: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  ticketList: {
    padding: spacing.base,
  },
  ticketCard: {
    marginBottom: spacing.md,
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    ...shadows.base,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  ticketHeaderLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  ticketSubject: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  ticketCategory: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  ticketTime: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  ticketPreview: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  badge: {
    fontSize: typography.fontSize.xs,
    paddingHorizontal: spacing.sm,
  },
  attendantName: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.primary,
  },
});

export default SupportScreen;
