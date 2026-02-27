import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { Text, Card, Button, RadioButton, Divider, Snackbar } from 'react-native-paper';
import { getCreditPackages, CreditPackage, createCreditPackagePayment } from '../api/payments';
import { colors } from '../theme/colors';

export default function CreditPackagesScreen() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [billingType, setBillingType] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [purchasing, setPurchasing] = useState(false);
  const [pixData, setPixData] = useState<{ qrcode_image?: string; payload?: string; invoice_url?: string } | null>(null);
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getCreditPackages();
        setPackages(data);
        if (data.length > 0) setSelectedPackage(data[0]);
      } catch (e) {
        console.warn('[CreditPackagesScreen] failed to load packages', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    setPurchasing(true);
    try {
      const result = await createCreditPackagePayment(selectedPackage.id, billingType);
      if (billingType === 'PIX' && (result.pix_qrcode || result.pix_payload)) {
        setPixData({
          qrcode_image: result.pix_qrcode,
          payload: result.pix_payload,
          invoice_url: result.invoice_url,
        });
        setPixModalVisible(true);
      } else {
        setSnackbarMessage('Pagamento iniciado! Verifique seu e-mail para concluir.');
        setSnackbarVisible(true);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Erro ao iniciar pagamento. Tente novamente.';
      Alert.alert('Erro', msg);
    } finally {
      setPurchasing(false);
    }
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
        <Text style={styles.title}>Escolha um Pacote de Créditos</Text>
        <Text style={styles.subtitle}>
          Créditos são usados para entrar em contato com projetos de clientes.
        </Text>

        {packages.map((pkg) => (
          <Card
            key={pkg.id}
            style={[
              styles.packageCard,
              selectedPackage?.id === pkg.id && styles.packageCardSelected,
            ]}
            onPress={() => setSelectedPackage(pkg)}
          >
            <Card.Content style={styles.packageContent}>
              <View style={styles.packageLeft}>
                <RadioButton
                  value={pkg.id}
                  status={selectedPackage?.id === pkg.id ? 'checked' : 'unchecked'}
                  onPress={() => setSelectedPackage(pkg)}
                  color={colors.primary}
                />
              </View>
              <View style={styles.packageInfo}>
                <Text style={styles.packageName}>{pkg.name}</Text>
                {pkg.description ? (
                  <Text style={styles.packageDesc}>{pkg.description}</Text>
                ) : null}
                <Text style={styles.packageCredits}>{pkg.credits_amount} créditos</Text>
              </View>
              <View style={styles.packagePrice}>
                <Text style={styles.priceValue}>
                  {pkg.price.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: pkg.currency || 'BRL',
                  })}
                </Text>
              </View>
            </Card.Content>
          </Card>
        ))}

        <Divider style={styles.divider} />

        <Text style={styles.sectionLabel}>Forma de Pagamento</Text>
        <View style={styles.billingRow}>
          <Card
            style={[styles.billingCard, billingType === 'PIX' && styles.billingCardSelected]}
            onPress={() => setBillingType('PIX')}
          >
            <Card.Content style={styles.billingContent}>
              <Text style={styles.billingIcon}>💠</Text>
              <Text style={styles.billingLabel}>PIX</Text>
            </Card.Content>
          </Card>
          <Card
            style={[styles.billingCard, billingType === 'CREDIT_CARD' && styles.billingCardSelected]}
            onPress={() => setBillingType('CREDIT_CARD')}
          >
            <Card.Content style={styles.billingContent}>
              <Text style={styles.billingIcon}>💳</Text>
              <Text style={styles.billingLabel}>Cartão</Text>
            </Card.Content>
          </Card>
        </View>

        {selectedPackage && (
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text style={styles.summaryTitle}>Resumo do Pedido</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{selectedPackage.name}</Text>
                <Text style={styles.summaryValue}>
                  {selectedPackage.price.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: selectedPackage.currency || 'BRL',
                  })}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Créditos</Text>
                <Text style={styles.summaryCredits}>{selectedPackage.credits_amount}</Text>
              </View>
            </Card.Content>
          </Card>
        )}

        <Button
          mode="contained"
          onPress={handlePurchase}
          loading={purchasing}
          disabled={!selectedPackage || purchasing}
          style={styles.buyButton}
          contentStyle={styles.buyButtonContent}
        >
          {billingType === 'PIX' ? 'Gerar QR Code PIX' : 'Pagar com Cartão'}
        </Button>
      </ScrollView>

      {/* PIX QR Code Modal */}
      <Modal
        visible={pixModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPixModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pixModal}>
            <Text style={styles.pixTitle}>QR Code PIX</Text>
            <Text style={styles.pixSubtitle}>
              Escaneie o QR Code com o app do seu banco ou copie o código
            </Text>
            {pixData?.qrcode_image ? (
              <Image
                source={{ uri: `data:image/png;base64,${pixData.qrcode_image}` }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>💠</Text>
                <Text style={styles.qrPlaceholderLabel}>QR Code</Text>
              </View>
            )}
            {pixData?.payload && (
              <Text style={styles.pixPayload} selectable numberOfLines={3}>
                {pixData.payload}
              </Text>
            )}
            <Text style={styles.pixNote}>
              O pagamento é confirmado automaticamente em alguns minutos.
            </Text>
            <Button
              mode="contained"
              onPress={() => setPixModalVisible(false)}
              style={styles.pixCloseButton}
            >
              Fechar
            </Button>
          </View>
        </View>
      </Modal>

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
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 },
  packageCard: { marginBottom: 10, borderRadius: 12, elevation: 1, borderWidth: 2, borderColor: 'transparent' },
  packageCardSelected: { borderColor: colors.primary, elevation: 3 },
  packageContent: { flexDirection: 'row', alignItems: 'center' },
  packageLeft: { marginRight: 4 },
  packageInfo: { flex: 1 },
  packageName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  packageDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  packageCredits: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 4 },
  packagePrice: { alignItems: 'flex-end' },
  priceValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  divider: { marginVertical: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  billingRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  billingCard: { flex: 1, borderRadius: 12, elevation: 1, borderWidth: 2, borderColor: 'transparent' },
  billingCardSelected: { borderColor: colors.primary },
  billingContent: { alignItems: 'center', paddingVertical: 12 },
  billingIcon: { fontSize: 28 },
  billingLabel: { fontSize: 13, fontWeight: '600', color: '#111827', marginTop: 4 },
  summaryCard: { borderRadius: 12, marginBottom: 20, backgroundColor: '#F3F4F6' },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 14, color: '#374151' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  summaryCredits: { fontSize: 14, fontWeight: '700', color: colors.primary },
  buyButton: { borderRadius: 12 },
  buyButtonContent: { paddingVertical: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pixModal: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center' },
  pixTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  pixSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  qrImage: { width: 220, height: 220, marginBottom: 16 },
  qrPlaceholder: { width: 200, height: 200, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  qrPlaceholderText: { fontSize: 60 },
  qrPlaceholderLabel: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  pixPayload: { fontSize: 11, color: '#6B7280', textAlign: 'center', marginBottom: 12, padding: 8, backgroundColor: '#F9FAFB', borderRadius: 8, width: '100%' },
  pixNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  pixCloseButton: { width: '100%', borderRadius: 10 },
});
