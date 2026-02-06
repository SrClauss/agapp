import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Portal, Dialog, Button, Text, Divider } from 'react-native-paper';
import { CostPreview } from '../api/contacts';

interface ConfirmContactModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: (message: string, proposalPrice?: number) => Promise<void>;
  costPreview: CostPreview | null;
  loading?: boolean;
}

export default function ConfirmContactModal({
  visible,
  onDismiss,
  onConfirm,
  costPreview,
  loading = false,
}: ConfirmContactModalProps) {
  const [message, setMessage] = useState('');
  const [proposalPrice, setProposalPrice] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const price = proposalPrice ? parseFloat(proposalPrice) : undefined;
      await onConfirm(message || 'Olá! Tenho interesse neste projeto.', price);
    } finally {
      setConfirming(false);
    }
  };

  if (!costPreview) {
    return null;
  }

  const newBalance = costPreview.current_balance - costPreview.credits_cost;
  const canAfford = costPreview.can_afford;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Confirmar Contato</Dialog.Title>
        <Dialog.Content>
          {loading ? (
            <ActivityIndicator size="large" />
          ) : (
            <>
              <Text variant="bodyMedium" style={styles.infoText}>
                Para entrar em contato com este cliente, serão deduzidos:
              </Text>

              <View style={styles.creditInfo}>
                <View style={styles.creditRow}>
                  <Text variant="titleLarge" style={styles.creditValue}>
                    {costPreview.credits_cost}
                  </Text>
                  <Text variant="bodyMedium" style={styles.creditLabel}>
                    créditos
                  </Text>
                </View>

                {costPreview.reason && (
                  <Text variant="bodySmall" style={styles.reasonText}>
                    {getReasonLabel(costPreview.reason)}
                  </Text>
                )}
              </View>

              <Divider style={styles.divider} />

              <View style={styles.balanceRow}>
                <Text variant="bodyMedium">Saldo atual:</Text>
                <Text variant="titleMedium" style={styles.balanceValue}>
                  {costPreview.current_balance} créditos
                </Text>
              </View>

              <View style={styles.balanceRow}>
                <Text variant="bodyMedium">Saldo após:</Text>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.balanceValue,
                    !canAfford && styles.insufficientBalance,
                  ]}
                >
                  {newBalance} créditos
                </Text>
              </View>

              {!canAfford && (
                <View style={styles.warningBox}>
                  <Text variant="bodyMedium" style={styles.warningText}>
                    ⚠️ Créditos insuficientes! Você precisa de mais créditos para
                    realizar esta ação.
                  </Text>
                </View>
              )}
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={confirming}>
            Cancelar
          </Button>
          {canAfford ? (
            <Button
              mode="contained"
              onPress={handleConfirm}
              disabled={confirming}
              loading={confirming}
            >
              Confirmar
            </Button>
          ) : (
            <Button mode="contained" onPress={onDismiss}>
              Comprar Créditos
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function getReasonLabel(reason: string): string {
  switch (reason) {
    case 'new_project':
      return 'Projeto novo (publicado há menos de 24h)';
    case 'old_project':
      return 'Projeto antigo (publicado há mais de 7 dias)';
    case 'moderate_interest':
      return 'Interesse moderado (2-4 profissionais já contataram)';
    case 'high_interest':
      return 'Alto interesse (5+ profissionais já contataram)';
    case 'contact_already_exists':
      return 'Você já tem um contato com este projeto';
    default:
      return reason;
  }
}

const styles = StyleSheet.create({
  infoText: {
    marginBottom: 16,
    color: '#6B7280',
  },
  creditInfo: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  creditValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#111827',
  },
  creditLabel: {
    color: '#6B7280',
  },
  reasonText: {
    marginTop: 8,
    color: '#6B7280',
    textAlign: 'center',
  },
  divider: {
    marginVertical: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceValue: {
    fontWeight: '600',
    color: '#111827',
  },
  insufficientBalance: {
    color: '#DC2626',
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  warningText: {
    color: '#991B1B',
  },
});
