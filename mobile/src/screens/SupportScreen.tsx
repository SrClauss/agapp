import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Text, FAB, Card, Badge, ActivityIndicator, List } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, typography, shadows } from '../theme';
import apiService from '../services/api';
import AppHeader from '../components/AppHeader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { useSnackbar } from '../hooks/useSnackbar';

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
  const { showSnackbar } = useSnackbar();

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
      showSnackbar('Não foi possível carregar os tickets', 'error');
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
      <AppHeader
        title="Suporte"
        subtitle={
          tickets.length === 0
            ? 'Nenhum ticket criado'
            : `${tickets.length} ticket${tickets.length > 1 ? 's' : ''}`
        }
        showBack
      />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {tickets.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="Nenhum ticket"
            message="Você ainda não criou nenhum ticket de suporte. Toque no botão + para criar um."
          />
        ) : (
          <View style={styles.ticketList}>
            {tickets.map((ticket) => {
              const lastMessage =
                ticket.messages[ticket.messages.length - 1]?.message || '';

              return (
                <TouchableOpacity
                  key={ticket.id}
                  onPress={() => handleTicketPress(ticket.id)}
                  activeOpacity={0.7}
                >
                  <Card style={styles.ticketCard}>
                    <Card.Content>
                      <View style={styles.ticketHeader}>
                        <View style={styles.ticketHeaderLeft}>
                          <Text style={styles.ticketSubject} numberOfLines={1}>
                            {ticket.subject}
                          </Text>
                          <View style={styles.badgesRow}>
                            <StatusBadge status={ticket.category} type="category" />
                          </View>
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
                          <StatusBadge status={ticket.status} type="status" />
                          <StatusBadge status={ticket.priority} type="priority" />
                        </View>

                        {ticket.attendant_name && (
                          <Text style={styles.attendantName}>
                            {ticket.attendant_name}
                          </Text>
                        )}
                      </View>
                    </Card.Content>
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
  ticketList: {
    padding: spacing.base,
  },
  ticketCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
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
  badgesRow: {
    marginTop: spacing.xs,
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
