import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Card, Divider, Chip, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../stores/authStore';
import { getUserCreditTransactions, CreditTransaction } from '../api/payments';
import { colors } from '../theme/colors';

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'purchase':
      return 'Compra';
    case 'usage':
      return 'Uso';
    case 'bonus':
      return 'Bônus';
    case 'refund':
      return 'Reembolso';
    case 'subscription':
      return 'Assinatura';
    default:
      return type;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'purchase':
    case 'bonus':
    case 'subscription':
      return '#10B981';
    case 'usage':
      return '#EF4444';
    case 'refund':
      return '#3B82F6';
    default:
      return '#6B7280';
  }
};

export default function CreditsScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getUserCreditTransactions();
        setTransactions(data);
      } catch (e) {
        console.warn('[CreditsScreen] failed to load transactions', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Balance Card */}
      <Card style={styles.balanceCard}>
        <Card.Content style={styles.balanceContent}>
          <Text style={styles.balanceLabel}>Saldo de Créditos</Text>
          <Text style={styles.balanceValue}>{user?.credits ?? 0}</Text>
          <Text style={styles.balanceSubLabel}>créditos disponíveis</Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('CreditPackages' as never)}
            style={styles.buyButton}
            buttonColor={colors.primary}
          >
            Comprar Créditos
          </Button>
        </Card.Content>
      </Card>

      {/* Transaction History */}
      <Text style={styles.sectionTitle}>Histórico de Transações</Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : transactions.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content>
            <Text style={styles.emptyText}>Nenhuma transação encontrada</Text>
          </Card.Content>
        </Card>
      ) : (
        transactions.map((tx, index) => (
          <Card key={tx.id || index} style={styles.transactionCard}>
            <Card.Content>
              <View style={styles.transactionRow}>
                <View style={styles.transactionLeft}>
                  <Chip
                    style={[styles.typeChip, { backgroundColor: getTypeColor(tx.type) + '20' }]}
                    textStyle={{ color: getTypeColor(tx.type), fontSize: 11 }}
                    compact
                  >
                    {getTypeLabel(tx.type)}
                  </Chip>
                  {tx.package_name && (
                    <Text style={styles.packageName}>{tx.package_name}</Text>
                  )}
                  <Text style={styles.transactionDate}>{formatDate(tx.created_at)}</Text>
                </View>
                <View style={styles.transactionRight}>
                  <Text
                    style={[
                      styles.creditsDelta,
                      { color: tx.credits > 0 ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {tx.credits > 0 ? `+${tx.credits}` : tx.credits}
                  </Text>
                  {tx.price > 0 && (
                    <Text style={styles.price}>
                      {tx.price.toLocaleString('pt-BR', { style: 'currency', currency: tx.currency || 'BRL' })}
                    </Text>
                  )}
                </View>
              </View>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 32 },
  balanceCard: {
    borderRadius: 16,
    marginBottom: 24,
    elevation: 4,
    backgroundColor: '#1E293B',
  },
  balanceContent: { alignItems: 'center', paddingVertical: 24 },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 8 },
  balanceValue: { color: '#FFFFFF', fontSize: 56, fontWeight: '900', lineHeight: 60 },
  balanceSubLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },
  buyButton: { marginTop: 20, minWidth: 180, borderRadius: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  loader: { marginTop: 40 },
  emptyCard: { borderRadius: 12, elevation: 1 },
  emptyText: { color: '#9CA3AF', textAlign: 'center', padding: 8 },
  transactionCard: { borderRadius: 12, marginBottom: 10, elevation: 1 },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transactionLeft: { flex: 1 },
  transactionRight: { alignItems: 'flex-end', marginLeft: 12 },
  typeChip: { alignSelf: 'flex-start', marginBottom: 4 },
  packageName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  transactionDate: { fontSize: 12, color: '#9CA3AF' },
  creditsDelta: { fontSize: 20, fontWeight: '800' },
  price: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
