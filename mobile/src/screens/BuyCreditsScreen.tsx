import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Chip,
  RadioButton,
  Portal,
  Dialog,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import {
  apiService,
  CreditPackage,
  PaymentResponse,
  UserResponse,
} from '../services/api';

type BuyCreditsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'BuyCredits'
>;

interface BuyCreditsScreenProps {
  navigation: BuyCreditsScreenNavigationProp;
}

export default function BuyCreditsScreen({
  navigation,
}: BuyCreditsScreenProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [billingType, setBillingType] = useState<string>('PIX');
  const [showPaymentDialog, setShowPaymentDialog] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [user, setUser] = useState<UserResponse | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const [packagesData, userData] = await Promise.all([
        apiService.getCreditPackages(token),
        apiService.getCurrentUser(token),
      ]);

      setPackages(packagesData);
      setUser(userData);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Erro ao carregar pacotes';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPackage = (pkg: CreditPackage): void => {
    setSelectedPackage(pkg);
    setShowPaymentDialog(true);
  };

  const handleProcessPayment = async (): Promise<void> => {
    if (!selectedPackage) return;

    setIsProcessing(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const payment = await apiService.createCreditPackagePayment(
        token,
        selectedPackage._id,
        billingType
      );

      setShowPaymentDialog(false);

      // Em modo de teste, simular pagamento
      if (payment.invoice_url && payment.invoice_url.includes('sandbox.asaas')) {
        Alert.alert(
          'Modo de Teste',
          'Deseja simular pagamento confirmado? (Modo de desenvolvimento)',
          [
            {
              text: 'Não',
              style: 'cancel',
            },
            {
              text: 'Sim, Confirmar',
              onPress: async () => {
                try {
                  const externalRef = `credits:${user?._id}:${selectedPackage._id}`;
                  await apiService.testPayment(externalRef, payment.value);

                  Alert.alert(
                    'Sucesso!',
                    'Créditos adicionados com sucesso!',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          navigation.goBack();
                        },
                      },
                    ]
                  );
                } catch (error) {
                  const errorMessage = (error as Error).message || 'Erro ao processar pagamento';
                  Alert.alert('Erro', errorMessage);
                }
              },
            },
          ]
        );
      } else if (payment.invoice_url) {
        // Abrir WebView com URL de pagamento
        navigation.navigate('PaymentWebView', {
          paymentUrl: payment.invoice_url,
          paymentId: payment.payment_id,
          onSuccess: () => {
            Alert.alert('Sucesso!', 'Créditos adicionados com sucesso!');
            loadData();
          },
        });
      } else {
        Alert.alert(
          'Atenção',
          'Pagamento criado! Aguarde a confirmação.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      const errorMessage = (error as Error).message || 'Erro ao processar pagamento';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando pacotes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Button
            mode="text"
            onPress={() => navigation.goBack()}
            icon="arrow-left"
            textColor={colors.primary}
          >
            Voltar
          </Button>
        </View>

        <Text style={styles.title}>Comprar Créditos</Text>
        <Text style={styles.subtitle}>
          Você possui {user?.credits || 0} créditos
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Cada crédito permite liberar 1 projeto e conversar com o cliente
          </Text>
        </View>

        {/* Packages List */}
        {packages.map((pkg) => {
          const totalCredits = pkg.credits + pkg.bonus_credits;
          const pricePerCredit = pkg.price / totalCredits;
          const isPopular = pkg.bonus_credits > 0;

          return (
            <Card key={pkg._id} style={styles.packageCard}>
              {isPopular && (
                <Chip
                  style={styles.popularChip}
                  textStyle={styles.popularChipText}
                  icon="star"
                >
                  Mais Popular
                </Chip>
              )}

              <Card.Content>
                <Text style={styles.packageName}>{pkg.name}</Text>

                {pkg.description && (
                  <Text style={styles.packageDescription}>{pkg.description}</Text>
                )}

                <View style={styles.creditsRow}>
                  <Text style={styles.creditsMain}>{pkg.credits} créditos</Text>
                  {pkg.bonus_credits > 0 && (
                    <Chip
                      style={styles.bonusChip}
                      textStyle={styles.bonusChipText}
                      compact
                    >
                      + {pkg.bonus_credits} bônus
                    </Chip>
                  )}
                </View>

                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.price}>
                      R$ {pkg.price.toFixed(2)}
                    </Text>
                    <Text style={styles.pricePerCredit}>
                      R$ {pricePerCredit.toFixed(2)} por crédito
                    </Text>
                  </View>

                  <Button
                    mode="contained"
                    onPress={() => handleSelectPackage(pkg)}
                    style={styles.buyButton}
                  >
                    Comprar
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      {/* Payment Dialog */}
      <Portal>
        <Dialog
          visible={showPaymentDialog}
          onDismiss={() => setShowPaymentDialog(false)}
        >
          <Dialog.Title>Escolha a forma de pagamento</Dialog.Title>
          <Dialog.Content>
            {selectedPackage && (
              <>
                <Text style={styles.dialogPackageInfo}>
                  Pacote: {selectedPackage.name}
                </Text>
                <Text style={styles.dialogPackageInfo}>
                  Total: R$ {selectedPackage.price.toFixed(2)}
                </Text>
                <Text style={styles.dialogPackageInfo}>
                  Créditos: {selectedPackage.credits + selectedPackage.bonus_credits}
                </Text>
              </>
            )}

            <View style={styles.paymentMethodSection}>
              <RadioButton.Group
                onValueChange={(value) => setBillingType(value)}
                value={billingType}
              >
                <RadioButton.Item
                  label="PIX (Confirmação instantânea)"
                  value="PIX"
                  labelStyle={styles.radioLabel}
                />
                <RadioButton.Item
                  label="Cartão de Crédito"
                  value="CREDIT_CARD"
                  labelStyle={styles.radioLabel}
                />
              </RadioButton.Group>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowPaymentDialog(false)}>Cancelar</Button>
            <Button
              onPress={handleProcessPayment}
              loading={isProcessing}
              disabled={isProcessing}
            >
              Continuar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.base,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  scrollContent: {
    padding: spacing.base,
  },
  header: {
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.lg,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.base,
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    padding: spacing.md,
    borderRadius: borderRadius.base,
    marginBottom: spacing.lg,
  },
  infoText: {
    fontSize: typography.fontSize.base,
    color: '#1976d2',
  },
  packageCard: {
    backgroundColor: colors.white,
    marginBottom: spacing.base,
    ...shadows.base,
  },
  popularChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.secondary,
    zIndex: 1,
  },
  popularChipText: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  packageName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  packageDescription: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  creditsMain: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginRight: 8,
  },
  bonusChip: {
    backgroundColor: colors.success,
  },
  bonusChipText: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  pricePerCredit: {
    fontSize: typography.fontSize.sm,
    color: colors.textDisabled,
  },
  buyButton: {
    minWidth: 120,
  },
  dialogPackageInfo: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  paymentMethodSection: {
    marginTop: spacing.base,
  },
  radioLabel: {
    fontSize: typography.fontSize.md,
  },
});
