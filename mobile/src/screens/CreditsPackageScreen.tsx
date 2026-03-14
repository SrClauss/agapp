import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { getCreditPackages, CreditPackage, createCreditPackagePayment } from '../api/payments';
import { colors } from '../theme/colors';

export default function CreditsPackageScreen() {
  const navigation = useNavigation();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCreditPackages();
      setPackages(data);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar pacotes');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyPackage = async (pkg: CreditPackage & { _id?: string }) => {
    try {
      setPurchasing(pkg.id);
      const packageId = pkg.id || (pkg as any)._id;
      const result = await createCreditPackagePayment(packageId, 'PIX');
      
      // Checkout URL do Asaas
      const checkoutUrl = result.invoice_url || result.invoiceUrl;
      
      if (checkoutUrl) {
        console.log('Abrindo Checkout do Asaas:', checkoutUrl);
        const supported = await Linking.canOpenURL(checkoutUrl);
        if (supported) {
          await Linking.openURL(checkoutUrl);
        } else {
          Alert.alert('Erro', 'Não foi possível abrir o Checkout. Verifique as permissões do navegador.');
        }
      } else {
        Alert.alert(
          'Pagamento Criado',
          'Seu pagamento foi iniciado. Escolha sua forma de pagamento no link enviado ao seu e-mail.',
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      console.error('Erro ao criar pagamento:', e);
      const responseData = e?.response?.data;
      const detail = responseData?.detail
        ? Array.isArray(responseData.detail)
          ? responseData.detail.map((d: any) => d.msg || JSON.stringify(d)).join('\n')
          : String(responseData.detail)
        : null;

      const errorMessage =
        detail ||
        responseData?.message ||
        e?.message ||
        'Erro ao criar pagamento. Tente novamente.';

      Alert.alert('Erro no Pagamento', errorMessage);
      if (__DEV__) {
        console.error('[Pagamento] responseData:', JSON.stringify(responseData, null, 2));
      }
    } finally {
      setPurchasing(null);
    }
  };

  const renderPackage = ({ item }: { item: CreditPackage }) => {
    const totalCredits = item.credits + (item.bonus_credits || 0);
    const isPurchasing = purchasing === item.id;

    return (
      <View style={styles.packageCard}>
        <View style={styles.packageHeader}>
          <Text style={styles.packageName}>{item.name}</Text>
          <Text style={styles.packagePrice}>R$ {item.price.toFixed(2).replace('.', ',')}</Text>
        </View>
        <View style={styles.creditsRow}>
          <Text style={styles.creditsText}>{item.credits} créditos</Text>
          {item.bonus_credits > 0 && (
            <Text style={styles.bonusText}>+{item.bonus_credits} bônus</Text>
          )}
        </View>
        {item.description ? (
          <Text style={styles.packageDescription}>{item.description}</Text>
        ) : null}
        {item.bonus_credits > 0 && (
          <Text style={styles.totalText}>Total: {totalCredits} créditos</Text>
        )}
        <Button
          mode="contained"
          style={styles.buyButton}
          loading={isPurchasing}
          disabled={isPurchasing}
          onPress={() => handleBuyPackage(item)}
        >
          {isPurchasing ? 'Processando...' : 'Comprar'}
        </Button>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={loadPackages} style={{ marginTop: 16 }}>
          Tentar novamente
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={packages}
        keyExtractor={(item) => item.id}
        renderItem={renderPackage}
        contentContainerStyle={styles.list}
        ListHeaderComponent={() => (
          <Text style={styles.subtitle}>
            Escolha um pacote de créditos para continuar entrando em contato com clientes e
            desbloquear novas oportunidades de trabalho.
          </Text>
        )}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>Nenhum pacote disponível no momento.</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  packageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  creditsText: {
    fontSize: 15,
    color: '#444',
  },
  bonusText: {
    fontSize: 13,
    color: '#e67e22',
    fontWeight: 'bold',
    backgroundColor: '#fef3e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  packageDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    marginBottom: 4,
  },
  totalText: {
    fontSize: 13,
    color: '#27ae60',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  buyButton: {
    marginTop: 12,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 15,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 15,
    marginTop: 40,
  },
});
