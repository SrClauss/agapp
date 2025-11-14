import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  HelperText,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, Category, ProjectCreateRequest } from '../services/api';

type CreateProjectScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateProject'>;

interface CreateProjectScreenProps {
  navigation: CreateProjectScreenNavigationProp;
}

export default function CreateProjectScreen({ navigation }: CreateProjectScreenProps): React.JSX.Element {
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

  // Form errors
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    loadCategories();
  }, []);

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
      Alert.alert('Erro', 'Não foi possível carregar as categorias. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const getSubcategories = (): string[] => {
    const category = categories.find(c => c.name === selectedCategory);
    return category?.subcategories || [];
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

    if (!address.trim()) {
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
          address: address.trim(),
          coordinates: [-46.6333, -23.5505], // Default to São Paulo (would use geocoding in production)
        },
        skills_required: [],
      };

      if (budgetMin) {
        projectData.budget_min = parseFloat(budgetMin);
      }

      if (budgetMax) {
        projectData.budget_max = parseFloat(budgetMax);
      }

      await apiService.createProject(token, projectData);

      Alert.alert(
        'Sucesso!',
        'Projeto criado com sucesso!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('ClientDashboard'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating project:', error);
      Alert.alert('Erro', error.message || 'Não foi possível criar o projeto. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3471b9" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Criar Novo Projeto</Text>
          <Text style={styles.subtitle}>
            Preencha as informações do seu projeto e conecte-se com profissionais qualificados
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Título do Projeto *"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            error={!!errors.title}
            style={styles.input}
          />
          <HelperText type="error" visible={!!errors.title}>
            {errors.title}
          </HelperText>

          <TextInput
            label="Descrição *"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            numberOfLines={4}
            error={!!errors.description}
            style={styles.input}
            placeholder="Descreva detalhadamente o que você precisa..."
          />
          <HelperText type="error" visible={!!errors.description}>
            {errors.description}
          </HelperText>

          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Categoria Principal *</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedCategory}
                onValueChange={(value) => {
                  setSelectedCategory(value);
                  setSelectedSubcategory(''); // Reset subcategory
                }}
                style={styles.picker}
              >
                <Picker.Item label="Selecione uma categoria..." value="" />
                {categories.map((cat) => (
                  <Picker.Item key={cat._id} label={cat.name} value={cat.name} />
                ))}
              </Picker>
            </View>
            <HelperText type="error" visible={!!errors.category}>
              {errors.category}
            </HelperText>
          </View>

          {selectedCategory && getSubcategories().length > 0 && (
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Subcategoria *</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedSubcategory}
                  onValueChange={setSelectedSubcategory}
                  style={styles.picker}
                >
                  <Picker.Item label="Selecione uma subcategoria..." value="" />
                  {getSubcategories().map((sub, index) => (
                    <Picker.Item key={index} label={sub} value={sub} />
                  ))}
                </Picker>
              </View>
              <HelperText type="error" visible={!!errors.subcategory}>
                {errors.subcategory}
              </HelperText>
            </View>
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
              />
              <HelperText type="error" visible={!!errors.budgetMin}>
                {errors.budgetMin}
              </HelperText>
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
              />
              <HelperText type="error" visible={!!errors.budgetMax}>
                {errors.budgetMax}
              </HelperText>
            </View>
          </View>

          <View style={styles.addressContainer}>
            <TextInput
              label="Endereço *"
              value={address}
              onChangeText={setAddress}
              mode="outlined"
              error={!!errors.address}
              style={styles.addressInput}
              placeholder="Clique na lupa para buscar"
              multiline
              numberOfLines={2}
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
          <HelperText type="error" visible={!!errors.address}>
            {errors.address}
          </HelperText>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.submitButton}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  form: {
    gap: 8,
  },
  input: {
    backgroundColor: '#fff',
  },
  pickerContainer: {
    marginBottom: 8,
  },
  pickerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginLeft: 4,
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  picker: {
    height: 56,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  budgetInput: {
    flex: 1,
  },
  addressContainer: {
    gap: 12,
  },
  addressInput: {
    backgroundColor: '#fff',
  },
  addressButton: {
    paddingVertical: 4,
  },
  submitButton: {
    marginTop: 24,
    paddingVertical: 8,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
});
