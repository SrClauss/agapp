import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, Button, RadioButton, Portal, Modal } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, typography, shadows } from '../theme';
import apiService from '../services/api';

type RouteParams = {
  CreateTicket: {
    projectId?: string;
    paymentId?: string;
  };
};

type CreateTicketScreenRouteProp = RouteProp<RouteParams, 'CreateTicket'>;

const CreateTicketScreen = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<CreateTicketScreenRouteProp>();

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [priority, setPriority] = useState<string>('normal');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);

  const categories = [
    { value: 'technical', label: 'Técnico' },
    { value: 'payment', label: 'Pagamento' },
    { value: 'general', label: 'Geral' },
    { value: 'complaint', label: 'Reclamação' },
  ];

  const priorities = [
    { value: 'low', label: 'Baixa' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'Alta' },
    { value: 'urgent', label: 'Urgente' },
  ];

  const handleSubmit = async () => {
    if (subject.trim().length < 5) {
      Alert.alert('Erro', 'O assunto deve ter pelo menos 5 caracteres');
      return;
    }

    if (message.trim().length < 10) {
      Alert.alert('Erro', 'A mensagem deve ter pelo menos 10 caracteres');
      return;
    }

    setLoading(true);

    try {
      const token = await apiService.getToken();
      if (!token) {
        throw new Error('Não autenticado');
      }

      const ticketData = {
        subject: subject.trim(),
        category,
        priority,
        message: message.trim(),
        related_project_id: route.params?.projectId || null,
        related_payment_id: route.params?.paymentId || null,
      };

      await apiService.createSupportTicket(token, ticketData);

      Alert.alert('Sucesso', 'Ticket criado com sucesso!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('Erro ao criar ticket:', error);
      Alert.alert('Erro', error.message || 'Não foi possível criar o ticket');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = () => {
    return categories.find((c) => c.value === category)?.label || 'Selecione';
  };

  const getPriorityLabel = () => {
    return priorities.find((p) => p.value === priority)?.label || 'Selecione';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Novo Ticket de Suporte</Text>
          <Text style={styles.subtitle}>
            Descreva seu problema ou dúvida e nossa equipe entrará em contato
          </Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Assunto</Text>
              <TextInput
                mode="outlined"
                placeholder="Ex: Problema com pagamento"
                value={subject}
                onChangeText={setSubject}
                maxLength={200}
                style={styles.input}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Categoria</Text>
              <Button
                mode="outlined"
                onPress={() => setShowCategoryModal(true)}
                style={styles.selectButton}
                contentStyle={styles.selectButtonContent}
                labelStyle={styles.selectButtonLabel}
              >
                {getCategoryLabel()}
              </Button>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prioridade</Text>
              <Button
                mode="outlined"
                onPress={() => setShowPriorityModal(true)}
                style={styles.selectButton}
                contentStyle={styles.selectButtonContent}
                labelStyle={styles.selectButtonLabel}
              >
                {getPriorityLabel()}
              </Button>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mensagem</Text>
              <TextInput
                mode="outlined"
                placeholder="Descreva detalhadamente seu problema..."
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                maxLength={5000}
                style={[styles.input, styles.textArea]}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
              />
              <Text style={styles.charCount}>
                {message.length}/5000 caracteres
              </Text>
            </View>
          </View>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
            labelStyle={styles.submitButtonLabel}
            buttonColor={colors.primary}
          >
            Criar Ticket
          </Button>
        </View>
      </ScrollView>

      {/* Category Modal */}
      <Portal>
        <Modal
          visible={showCategoryModal}
          onDismiss={() => setShowCategoryModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Selecione a Categoria</Text>
          <RadioButton.Group
            onValueChange={(value) => {
              setCategory(value);
              setShowCategoryModal(false);
            }}
            value={category}
          >
            {categories.map((cat) => (
              <View key={cat.value} style={styles.radioItem}>
                <RadioButton.Android value={cat.value} color={colors.primary} />
                <Text style={styles.radioLabel}>{cat.label}</Text>
              </View>
            ))}
          </RadioButton.Group>
        </Modal>
      </Portal>

      {/* Priority Modal */}
      <Portal>
        <Modal
          visible={showPriorityModal}
          onDismiss={() => setShowPriorityModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Selecione a Prioridade</Text>
          <RadioButton.Group
            onValueChange={(value) => {
              setPriority(value);
              setShowPriorityModal(false);
            }}
            value={priority}
          >
            {priorities.map((pri) => (
              <View key={pri.value} style={styles.radioItem}>
                <RadioButton.Android value={pri.value} color={colors.primary} />
                <Text style={styles.radioLabel}>{pri.label}</Text>
              </View>
            ))}
          </RadioButton.Group>
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
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
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  form: {
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  selectButton: {
    borderColor: colors.border,
    borderRadius: spacing.xs,
  },
  selectButtonContent: {
    justifyContent: 'flex-start',
    paddingVertical: spacing.xs,
  },
  selectButtonLabel: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
  },
  submitButton: {
    paddingVertical: spacing.xs,
    borderRadius: spacing.sm,
  },
  submitButtonLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  modal: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    margin: spacing.xl,
    borderRadius: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  radioLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
});

export default CreateTicketScreen;
