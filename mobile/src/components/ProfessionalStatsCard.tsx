import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Text, Title, IconButton } from 'react-native-paper';
import { colors } from '../theme/colors';
import { getProfessionalStats, ProfessionalStats } from '../api/professional';
import useAuthStore from '../stores/authStore';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export function getDisplayedCredits(store: any) {
  return store?.user?.credits ?? 0;
}

export default function ProfessionalStatsCard() {
  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<ProfessionalStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read auth store unconditionally to avoid changing hook order between renders
  const authStore = useAuthStore((s) => s);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProfessionalStats();
      setStats(data);
    } catch (err: any) {
      console.warn('Erro ao buscar estatísticas profissionais', err);
      setError(err?.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  return (
    <Card style={styles.card}>
      {/* header */}
      <View style={[styles.header, { backgroundColor: colors.primary }] }>
        <Title style={styles.headerTitle}>Minhas Estatísticas</Title>
      </View>

      <Card.Content style={styles.content}>
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.row}> 
            <Text style={styles.errorText}>{error}</Text>
            <IconButton icon="reload" size={18} onPress={fetchStats} />
          </View>
        )}

        {!loading && stats && (
          <View style={styles.grid}>
            <TouchableOpacity activeOpacity={0.8} style={styles.statCard} onPress={() => {}}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(0,109,88,0.06)' }]}>
                <MaterialCommunityIcons name="crown" size={20} color={colors.primary} />
              </View>
              <Text style={styles.smallLabel}>Assinatura</Text>
              <Text style={styles.bigValue}>{stats.active_subscriptions ? 'Ativa' : '—'}</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} style={styles.statCard} onPress={() => {}}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(0,109,88,0.04)' }]}>
                <MaterialCommunityIcons name="currency-usd" size={20} color={colors.primary} />
              </View>
              <Text style={styles.smallLabel}>Meus Créditos</Text>
              <Text style={styles.bigValue}>{getDisplayedCredits(authStore)}</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} style={styles.statCard} onPress={() => {}}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(0,109,88,0.04)' }]}>
                <MaterialCommunityIcons name="comment-text" size={20} color={colors.primary} />
              </View>
              <Text style={styles.smallLabel}>Contatos</Text>
              <Text style={styles.bigValue}>{stats.contacts_received ?? 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} style={styles.statCard} onPress={() => {}}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(0,109,88,0.04)' }]}>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />
              </View>
              <Text style={styles.smallLabel}>Concluídos</Text>
              <Text style={styles.bigValue}>{stats.projects_completed ?? 0}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: 16,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    paddingTop: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  smallLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 4,
  },
  bigValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: { marginLeft: 8, color: '#666' },
  errorText: { color: '#c0392b' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
