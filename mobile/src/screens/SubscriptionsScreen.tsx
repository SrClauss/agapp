import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text, Card, Button, Chip, Divider, Snackbar } from 'react-native-paper';
import { colors } from '../theme/colors';
import client from '../api/axiosClient';

interface PlanConfig {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  credits_per_week: number;
  is_active: boolean;
  discount_3_months?: number;
  discount_6_months?: number;
  discount_12_months?: number;
}

interface SubscriptionStatus {
  has_subscription: boolean;
  status?: string;
  plan_name?: string;
  credits_per_week?: number;
  next_renewal?: string;
  monthly_price?: number;
}

interface PaymentResponse {
  payment_id: string;
  status: string;
  value: number;
  billing_type: string;
  due_date: string;
  invoice_url?: string;
  pix_qrcode?: string;
  pix_payload?: string;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'active':
      return 'Ativa';
    case 'cancelled':
      return 'Cancelada';
    case 'pending':
      return 'Pendente';
    case 'expired':
      return 'Expirada';
    default:
      return status ?? '—';
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'active':
      return '#10B981';
    case 'cancelled':
    case 'expired':
      return '#EF4444';
    case 'pending':
      return '#F59E0B';
    default:
      return '#6B7280';
  }
};

export default function SubscriptionsScreen() {
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, statusRes] = await Promise.all([
        client.get('/api/payments/plans'),
        client.get('/api/payments/subscription/status'),
      ]);
      setPlans(plansRes.data);
      setSubscriptionStatus(statusRes.data);
    } catch (e) {
      console.warn('[SubscriptionsScreen] failed to load data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubscribe = async (plan: PlanConfig) => {
    setSubscribing(plan.id);
    try {
      const response = await client.post('/api/payments/subscription', {
        plan_id: plan.id,
        billing_type: 'PIX',
        cycle_months: 1,
      });
      const result: PaymentResponse = response.data;
      if (result.pix_payload) {
        Alert.alert(
          'Pagamento PIX',
          `Copie o código PIX para pagar:\n\n${result.pix_payload}\n\nSua assinatura será ativada automaticamente após a confirmação.`,
          [{ text: 'OK', onPress: loadData }]
        );
      } else {
        setSnackbarMessage('Assinatura iniciada! Verifique seu e-mail.');
        setSnackbarVisible(true);
        loadData();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Erro ao contratar assinatura.';
      Alert.alert('Erro', msg);
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Assinatura',
      'Tem certeza que deseja cancelar sua assinatura? Você perderá o acesso aos benefícios ao final do período pago.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Cancelar Assinatura',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await client.post('/api/payments/subscription/cancel');
              setSnackbarMessage('Assinatura cancelada com sucesso.');
              setSnackbarVisible(true);
              loadData();
            } catch (e: any) {
              const msg = e?.response?.data?.detail || 'Erro ao cancelar assinatura.';
              Alert.alert('Erro', msg);
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Current Subscription Status */}
        <Text style={styles.sectionTitle}>Sua Assinatura</Text>
        {subscriptionStatus?.has_subscription ? (
          <Card style={styles.statusCard}>
            <Card.Content>
              <View style={styles.statusRow}>
                <View>
                  <Text style={styles.planName}>
                    {subscriptionStatus.plan_name ?? 'Plano Ativo'}
                  </Text>
                  <Text style={styles.renewalDate}>
                    Renovação: {formatDate(subscriptionStatus.next_renewal)}
                  </Text>
                  {subscriptionStatus.credits_per_week != null && (
                    <Text style={styles.creditsInfo}>
                      {subscriptionStatus.credits_per_week} créditos/semana
                    </Text>
                  )}
                </View>
                <Chip
                  style={{ backgroundColor: getStatusColor(subscriptionStatus.status) + '20' }}
                  textStyle={{ color: getStatusColor(subscriptionStatus.status), fontWeight: '700' }}
                >
                  {getStatusLabel(subscriptionStatus.status)}
                </Chip>
              </View>
              {subscriptionStatus.status === 'active' && (
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  loading={cancelling}
                  disabled={cancelling}
                  textColor="#EF4444"
                  style={styles.cancelButton}
                >
                  Cancelar Assinatura
                </Button>
              )}
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.noSubCard}>
            <Card.Content>
              <Text style={styles.noSubText}>
                Você não possui uma assinatura ativa. Assine um plano para receber créditos semanais automaticamente!
              </Text>
            </Card.Content>
          </Card>
        )}

        <Divider style={styles.divider} />

        {/* Available Plans */}
        <Text style={styles.sectionTitle}>Planos Disponíveis</Text>
        {plans.length === 0 ? (
          <Card style={styles.noSubCard}>
            <Card.Content>
              <Text style={styles.noSubText}>Nenhum plano disponível no momento.</Text>
            </Card.Content>
          </Card>
        ) : (
          plans.map((plan) => (
            <Card key={plan.id} style={styles.planCard}>
              <Card.Content>
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>{plan.name}</Text>
                  <Text style={styles.planPrice}>
                    {plan.monthly_price.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                    <Text style={styles.planPriceMonth}>/mês</Text>
                  </Text>
                </View>
                {plan.description ? (
                  <Text style={styles.planDesc}>{plan.description}</Text>
                ) : null}
                <View style={styles.planFeature}>
                  <Text style={styles.featureIcon}>✅</Text>
                  <Text style={styles.featureText}>
                    {plan.credits_per_week} créditos por semana
                  </Text>
                </View>
                {plan.discount_3_months && plan.discount_3_months > 0 ? (
                  <View style={styles.planFeature}>
                    <Text style={styles.featureIcon}>🏷️</Text>
                    <Text style={styles.featureText}>
                      {plan.discount_3_months}% de desconto no plano trimestral
                    </Text>
                  </View>
                ) : null}
                <Button
                  mode="contained"
                  onPress={() => handleSubscribe(plan)}
                  loading={subscribing === plan.id}
                  disabled={
                    !!subscribing ||
                    (subscriptionStatus?.has_subscription &&
                      subscriptionStatus?.status === 'active')
                  }
                  style={styles.subscribeButton}
                >
                  {subscriptionStatus?.has_subscription && subscriptionStatus?.status === 'active'
                    ? 'Já possui assinatura'
                    : 'Assinar via PIX'}
                </Button>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        action={{ label: 'OK', onPress: () => setSnackbarVisible(false) }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statusCard: { borderRadius: 16, elevation: 2, marginBottom: 16 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  renewalDate: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  creditsInfo: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 4 },
  cancelButton: { marginTop: 8, borderColor: '#EF4444' },
  noSubCard: { borderRadius: 12, elevation: 1, marginBottom: 16, backgroundColor: '#FFF7ED' },
  noSubText: { fontSize: 14, color: '#92400E', lineHeight: 20 },
  divider: { marginVertical: 20 },
  planCard: { borderRadius: 16, elevation: 2, marginBottom: 14 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  planTitle: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  planPrice: { fontSize: 20, fontWeight: '900', color: '#111827' },
  planPriceMonth: { fontSize: 12, fontWeight: '400', color: '#6B7280' },
  planDesc: { fontSize: 13, color: '#6B7280', marginBottom: 12, lineHeight: 18 },
  planFeature: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  featureIcon: { fontSize: 14, marginRight: 8 },
  featureText: { fontSize: 13, color: '#374151' },
  subscribeButton: { marginTop: 12, borderRadius: 10 },
});
