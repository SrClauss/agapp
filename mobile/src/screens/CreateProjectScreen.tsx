import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Checkbox,
} from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, Category, ProjectCreateRequest } from '../services/api';
import { colors, spacing, typography } from '../theme';
import AppHeader from '../components/AppHeader';
import SelectInput, { SelectOption } from '../components/SelectInput';
import LoadingOverlay from '../components/LoadingOverlay';
import { useSnackbar } from '../hooks/useSnackbar';

type CreateProjectScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateProject'>;

interface CreateProjectScreenProps {
  navigation: CreateProjectScreenNavigationProp;
}

export default function CreateProjectScreen({ navigation }: CreateProjectScreenProps): React.JSX.Element {
  const { showSnackbar } = useSnackbar();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form fields
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [budgetMin, setBudgetMin] = useState<string>('');
  const [budgetMax, setBudgetMax] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [remoteExecution, setRemoteExecution] = useState<boolean>(false);

  // Form errors
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    loadCategories();
  }, []);

  // Update remote execution when category changes
  useEffect(() => {
    if (selectedCategory) {
      const category = categories.find(c => c.name === selectedCategory);
      if (category && category.default_remote_execution !== undefined) {
        setRemoteExecution(category.default_remote_execution);
      }
    }
  }, [selectedCategory, categories]);

  const loadCategories = async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const categoriesData = await apiService.getCategories(token);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
      showSnackbar('Não foi possível carregar as categorias', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryOptions = (): SelectOption[] => {
    return categories.map(cat => ({
      label: cat.name,
      value: cat.name,
    }));
  };

  const getSubcategoryOptions = (): SelectOption[] => {
    const category = categories.find(c => c.name === selectedCategory);
    return category?.subcategories.map(sub => ({
      label: sub,
      value: sub,
    })) || [];
  };

  const validate = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!title.trim()) {
      newErrors.title = 'Título é obrigatório';
    }

    if (!description.trim()) {
      newErrors.description = 'Descrição é obrigatória';
    } else if (description.trim().length < 20) {
      newErrors.description = 'Descrição deve ter pelo menos 20 caracteres';
    }

    if (!selectedCategory) {
      newErrors.category = 'Selecione uma categoria';
    }

    if (!selectedSubcategory) {
      newErrors.subcategory = 'Selecione uma subcategoria';
    }

    // Address is only required if not remote execution
    if (!remoteExecution && !address.trim()) {
      newErrors.address = 'Endereço é obrigatório';
    }

    if (budgetMin && isNaN(parseFloat(budgetMin))) {
      newErrors.budgetMin = 'Orçamento mínimo inválido';
    }

    if (budgetMax && isNaN(parseFloat(budgetMax))) {
      newErrors.budgetMax = 'Orçamento máximo inválido';
    }

    if (budgetMin && budgetMax && parseFloat(budgetMin) > parseFloat(budgetMax)) {
      newErrors.budgetMax = 'Orçamento máximo deve ser maior que o mínimo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validate()) {
      showSnackbar('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const projectData: ProjectCreateRequest = {
        title: title.trim(),
        description: description.trim(),
        category: {
          main: selectedCategory,
          sub: selectedSubcategory,
        },
        location: {
          address: address.trim() || 'Remoto',
          coordinates: [-46.6333, -23.5505], // Default to São Paulo (would use geocoding in production)
        },
        skills_required: [],
        remote_execution: remoteExecution,
      };

      if (budgetMin) {
        projectData.budget_min = parseFloat(budgetMin);
      }

      if (budgetMax) {
        projectData.budget_max = parseFloat(budgetMax);
      }

      await apiService.createProject(token, projectData);

      showSnackbar('Projeto criado com sucesso!', 'success');
      setTimeout(() => navigation.navigate('ClientDashboard'), 1000);
    } catch (error: any) {
      console.error('Error creating project:', error);
      showSnackbar(error.message || 'Não foi possível criar o projeto', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Criar Novo Projeto" showBack />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.subtitle}>
              Preencha as informações do seu projeto e conecte-se com profissionais qualificados
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label="Título do Projeto"
              value={title}
              onChangeText={setTitle}
              mode="outlined"
              error={!!errors.title}
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            {errors.title && (
              <Text style={styles.errorText}>{errors.title}</Text>
            )}

            <TextInput
              label="Descrição"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              multiline
              numberOfLines={4}
              error={!!errors.description}
              style={styles.input}
              placeholder="Descreva detalhadamente o que você precisa..."
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}

            <SelectInput
              label="Categoria Principal"
              value={selectedCategory}
              options={getCategoryOptions()}
              onValueChange={(value) => {
                setSelectedCategory(value);
                setSelectedSubcategory(''); // Reset subcategory
              }}
              error={!!errors.category}
              helperText={errors.category}
              required
            />

            {selectedCategory && getSubcategoryOptions().length > 0 && (
              <SelectInput
                label="Subcategoria"
                value={selectedSubcategory}
                options={getSubcategoryOptions()}
                onValueChange={setSelectedSubcategory}
                error={!!errors.subcategory}
                helperText={errors.subcategory}
                required
              />
            )}

            <View style={styles.budgetRow}>
              <View style={styles.budgetInput}>
                <TextInput
                  label="Orçamento Mínimo (R$)"
                  value={budgetMin}
                  onChangeText={setBudgetMin}
                  mode="outlined"
                  keyboardType="numeric"
                  error={!!errors.budgetMin}
                  style={styles.input}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                />
                {errors.budgetMin && (
                  <Text style={styles.errorText}>{errors.budgetMin}</Text>
                )}
              </View>

              <View style={styles.budgetInput}>
                <TextInput
                  label="Orçamento Máximo (R$)"
                  value={budgetMax}
                  onChangeText={setBudgetMax}
                  mode="outlined"
                  keyboardType="numeric"
                  error={!!errors.budgetMax}
                  style={styles.input}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                />
                {errors.budgetMax && (
                  <Text style={styles.errorText}>{errors.budgetMax}</Text>
                )}
              </View>
            </View>

            <View style={styles.addressContainer}>
              <TextInput
                label={remoteExecution ? "Endereço (opcional)" : "Endereço"}
                value={address}
                onChangeText={setAddress}
                mode="outlined"
                error={!!errors.address}
                style={styles.input}
                placeholder="Clique na lupa para buscar"
                multiline
                numberOfLines={2}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
              />
              <Button
                mode="contained"
                onPress={() => {
                  navigation.navigate('AddressSearch', {
                    onSelect: (selectedAddress: string) => {
                      if (selectedAddress) {
                        setAddress(selectedAddress);
                      }
                    },
                  });
                }}
                style={styles.addressButton}
                icon="magnify"
              >
                Buscar
              </Button>
            </View>
            {errors.address && (
              <Text style={styles.errorText}>{errors.address}</Text>
            )}

            <View style={styles.checkboxContainer}>
              <Checkbox.Item
                label="Permite execução remota"
                status={remoteExecution ? 'checked' : 'unchecked'}
                onPress={() => setRemoteExecution(!remoteExecution)}
                labelStyle={styles.checkboxLabel}
              />
            </View>
            <Text style={styles.infoText}>
              {remoteExecution
                ? 'Este projeto pode ser executado remotamente. O endereço é opcional.'
                : 'Este projeto requer presença física no local especificado.'}
            </Text>

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.submitButton}
              buttonColor={colors.primary}
            >
              {isSubmitting ? 'Criando...' : 'Criar Projeto'}
            </Button>

            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              disabled={isSubmitting}
              style={styles.cancelButton}
            >
              Cancelar
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LoadingOverlay visible={isLoading} message="Carregando categorias..." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  budgetInput: {
    flex: 1,
  },
  addressContainer: {
    gap: spacing.sm,
  },
  addressButton: {
    paddingVertical: spacing.xs,
  },
  checkboxContainer: {
    marginTop: spacing.sm,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  submitButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.xs,
  },
  cancelButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
});
