import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '../theme';
import AppHeader from '../components/AppHeader';
import SelectInput, { SelectOption } from '../components/SelectInput';
import { useSnackbar } from '../hooks/useSnackbar';
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
  const { showSnackbar } = useSnackbar();

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [priority, setPriority] = useState<string>('normal');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const categories: SelectOption[] = [
    { value: 'technical', label: 'Técnico' },
    { value: 'payment', label: 'Pagamento' },
    { value: 'general', label: 'Geral' },
    { value: 'complaint', label: 'Reclamação' },
  ];

  const priorities: SelectOption[] = [
    { value: 'low', label: 'Baixa' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'Alta' },
    { value: 'urgent', label: 'Urgente' },
  ];

  const handleSubmit = async () => {
    if (subject.trim().length < 5) {
      showSnackbar('O assunto deve ter pelo menos 5 caracteres', 'error');
      return;
    }

    if (message.trim().length < 10) {
      showSnackbar('A mensagem deve ter pelo menos 10 caracteres', 'error');
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

      showSnackbar('Ticket criado com sucesso!', 'success');
      setTimeout(() => navigation.goBack(), 1000);
    } catch (error: any) {
      console.error('Erro ao criar ticket:', error);
      showSnackbar(error.message || 'Não foi possível criar o ticket', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Novo Ticket de Suporte" showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            <Text style={styles.subtitle}>
              Descreva seu problema ou dúvida e nossa equipe entrará em contato
            </Text>

            <View style={styles.form}>
              <TextInput
                mode="outlined"
                label="Assunto"
                placeholder="Ex: Problema com pagamento"
                value={subject}
                onChangeText={setSubject}
                maxLength={200}
                style={styles.input}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
              />

              <SelectInput
                label="Categoria"
                value={category}
                options={categories}
                onValueChange={setCategory}
                required
              />

              <SelectInput
                label="Prioridade"
                value={priority}
                options={priorities}
                onValueChange={setPriority}
                required
              />

              <TextInput
                mode="outlined"
                label="Mensagem"
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
              <Text style={styles.charCount}>{message.length}/5000 caracteres</Text>
            </View>

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
              buttonColor={colors.primary}
            >
              Criar Ticket
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.md,
    marginBottom: spacing.xl,
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
    marginTop: -spacing.sm,
  },
  submitButton: {
    paddingVertical: spacing.xs,
  },
});

export default CreateTicketScreen;
