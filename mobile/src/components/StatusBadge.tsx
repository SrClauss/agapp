import React from 'react';
import { Badge } from 'react-native-paper';
import { StyleSheet } from 'react-native';
import { colors } from '../theme';

interface StatusBadgeProps {
  status: string;
  variant?: 'status' | 'priority' | 'category';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'status',
}) => {
  const getStatusConfig = () => {
    if (variant === 'status') {
      const statusMap: Record<string, { label: string; color: string }> = {
        open: { label: 'Aberto', color: colors.success },
        in_progress: { label: 'Em Progresso', color: colors.warning },
        waiting_user: { label: 'Aguardando', color: colors.info },
        resolved: { label: 'Resolvido', color: colors.textSecondary },
        closed: { label: 'Fechado', color: colors.textSecondary },
        pending: { label: 'Pendente', color: colors.warning },
        accepted: { label: 'Aceito', color: colors.success },
        rejected: { label: 'Rejeitado', color: colors.error },
        active: { label: 'Ativo', color: colors.success },
        inactive: { label: 'Inativo', color: colors.textSecondary },
      };
      return statusMap[status] || { label: status, color: colors.textSecondary };
    }

    if (variant === 'priority') {
      const priorityMap: Record<string, { label: string; color: string }> = {
        low: { label: 'Baixa', color: colors.info },
        normal: { label: 'Normal', color: colors.primary },
        high: { label: 'Alta', color: colors.warning },
        urgent: { label: 'Urgente', color: colors.error },
      };
      return priorityMap[status] || { label: status, color: colors.textSecondary };
    }

    if (variant === 'category') {
      const categoryMap: Record<string, { label: string; color: string }> = {
        technical: { label: 'Técnico', color: colors.info },
        payment: { label: 'Pagamento', color: colors.success },
        general: { label: 'Geral', color: colors.primary },
        complaint: { label: 'Reclamação', color: colors.error },
      };
      return categoryMap[status] || { label: status, color: colors.textSecondary };
    }

    return { label: status, color: colors.textSecondary };
  };

  const { label, color } = getStatusConfig();

  return <Badge style={[styles.badge, { backgroundColor: color }]}>{label}</Badge>;
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    fontSize: 11,
  },
});

export default StatusBadge;
