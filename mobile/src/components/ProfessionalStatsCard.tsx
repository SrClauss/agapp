import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Card, Text, Title, Paragraph, IconButton } from 'react-native-paper';
import { colors } from '../theme/colors';
import { getProfessionalStats, ProfessionalStats } from '../api/professional';
import { useFocusEffect } from '@react-navigation/native';

export default function ProfessionalStatsCard() {
  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<ProfessionalStats | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <Card.Content>
        <Title style={styles.title}>Minhas Estatísticas</Title>
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
            <View style={styles.gridItem}>
              <Text style={styles.label}>Assinaturas Ativas</Text>
              <Text style={styles.value}>{stats.active_subscriptions ?? 0}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Créditos</Text>
              <Text style={styles.value}>{stats.credits_available ?? 0}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Contatos Recebidos</Text>
              <Text style={styles.value}>{stats.contacts_received ?? 0}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Projetos Concluídos</Text>
              <Text style={styles.value}>{stats.projects_completed ?? 0}</Text>
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
  },
  title: {
    color: colors.text,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 12,
  },
  label: {
    color: '#666',
    fontSize: 12,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
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
