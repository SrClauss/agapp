import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, Button, Checkbox, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { createProject, ProjectCreateData, ProjectLocation } from '../api/projects';
import { colors } from '../theme/colors';

interface RouteParams {
  categoryName: string;
  subcategoryName: string;
  defaultRemoteExecution?: boolean;
}

export default function CreateProjectScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [remoteExecution, setRemoteExecution] = useState(params?.defaultRemoteExecution || false);
  
  // Location state
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [customAddress, setCustomAddress] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [customState, setCustomState] = useState('');
  const [customZipCode, setCustomZipCode] = useState('');
  
  // Loading states
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch current location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Negada',
          'Precisamos de acesso à sua localização para melhorar a busca por profissionais.'
        );
        setUseCurrentLocation(false);
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to get address
      const [geocoded] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      let address = '';
      if (geocoded) {
        const parts = [
          geocoded.street,
          geocoded.streetNumber,
          geocoded.district,
          geocoded.city,
          geocoded.region,
        ].filter(Boolean);
        address = parts.join(', ');
      }

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address,
      });
    } catch (error) {
      console.warn('Erro ao obter localização:', error);
      Alert.alert('Erro', 'Não foi possível obter sua localização atual.');
      setUseCurrentLocation(false);
    } finally {
      setLoadingLocation(false);
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Erro', 'Por favor, informe um título para o projeto.');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Erro', 'Por favor, descreva o que você precisa.');
      return false;
    }
    if (!useCurrentLocation && !customAddress.trim()) {
      Alert.alert('Erro', 'Por favor, informe o endereço para o serviço.');
      return false;
    }
    if (useCurrentLocation && !currentLocation) {
      Alert.alert('Erro', 'Aguarde a localização ser obtida ou informe um endereço manualmente.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      // Build location object with proper typing
      const location: ProjectLocation = {};
      
      if (useCurrentLocation && currentLocation) {
        location.coordinates = [currentLocation.longitude, currentLocation.latitude];
        location.address = currentLocation.address;
      } else {
        location.address = customAddress.trim();
        if (customCity.trim()) location.city = customCity.trim();
        if (customState.trim()) location.state = customState.trim();
        if (customZipCode.trim()) location.zip_code = customZipCode.trim();
      }

      // Build project data
      const projectData: ProjectCreateData = {
        title: title.trim(),
        description: description.trim(),
        category: {
          main: params.categoryName,
          sub: params.subcategoryName,
        },
        location,
        remote_execution: remoteExecution,
      };

      // Add budget if provided
      const minBudget = parseFloat(budgetMin);
      const maxBudget = parseFloat(budgetMax);
      if (!isNaN(minBudget) && minBudget > 0) {
        projectData.budget_min = minBudget;
      }
      if (!isNaN(maxBudget) && maxBudget > 0) {
        projectData.budget_max = maxBudget;
      }

      // Create the project
      const project = await createProject(projectData);

      Alert.alert(
        'Projeto Criado!',
        'Seu projeto foi criado com sucesso. Profissionais da região poderão entrar em contato.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('WelcomeCustomer' as never),
          },
        ]
      );
    } catch (error: unknown) {
      console.error('Erro ao criar projeto:', error);
      let message = 'Não foi possível criar o projeto. Tente novamente.';
      if (error instanceof Error && 'response' in error) {
        const axiosError = error as { response?: { data?: { detail?: string } } };
        if (axiosError.response?.data?.detail) {
          message = axiosError.response.data.detail;
        }
      }
      Alert.alert('Erro', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Criar Projeto</Text>
              <Text style={styles.headerSubtitle}>
                {params?.categoryName} › {params?.subcategoryName}
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Title */}
            <TextInput
              label="Título do Projeto"
              value={title}
              onChangeText={setTitle}
              mode="outlined"
              style={styles.input}
              placeholder="Ex: Conserto de torneira vazando"
            />

            {/* Description */}
            <TextInput
              label="Descreva o que você precisa"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={[styles.input, styles.textArea]}
              placeholder="Descreva detalhadamente o serviço que você precisa..."
            />

            {/* Budget Range */}
            <Text style={styles.sectionTitle}>Orçamento (opcional)</Text>
            <View style={styles.budgetRow}>
              <TextInput
                label="Mínimo (R$)"
                value={budgetMin}
                onChangeText={setBudgetMin}
                mode="outlined"
                keyboardType="numeric"
                style={[styles.input, styles.budgetInput]}
                placeholder="0,00"
              />
              <Text style={styles.budgetSeparator}>até</Text>
              <TextInput
                label="Máximo (R$)"
                value={budgetMax}
                onChangeText={setBudgetMax}
                mode="outlined"
                keyboardType="numeric"
                style={[styles.input, styles.budgetInput]}
                placeholder="0,00"
              />
            </View>

            {/* Remote Execution */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setRemoteExecution(!remoteExecution)}
            >
              <Checkbox
                status={remoteExecution ? 'checked' : 'unchecked'}
                onPress={() => setRemoteExecution(!remoteExecution)}
              />
              <View style={styles.checkboxTextContainer}>
                <Text style={styles.checkboxLabel}>Aceito execução remota</Text>
                <Text style={styles.checkboxHint}>
                  O profissional pode resolver sem ir ao local
                </Text>
              </View>
            </TouchableOpacity>

            {/* Location Section */}
            <Text style={styles.sectionTitle}>Localização do Serviço</Text>
            
            {/* Current Location Option */}
            <TouchableOpacity
              style={[
                styles.locationOption,
                useCurrentLocation && styles.locationOptionSelected,
              ]}
              onPress={() => {
                setUseCurrentLocation(true);
                if (!currentLocation) {
                  getCurrentLocation();
                }
              }}
            >
              <MaterialIcons
                name={useCurrentLocation ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={24}
                color={useCurrentLocation ? colors.primary : '#666'}
              />
              <View style={styles.locationOptionContent}>
                <Text style={styles.locationOptionTitle}>Usar localização atual</Text>
                {loadingLocation ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Obtendo localização...</Text>
                  </View>
                ) : currentLocation?.address ? (
                  <Text style={styles.locationAddress}>{currentLocation.address}</Text>
                ) : (
                  <Text style={styles.locationHint}>Toque para obter sua localização</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Custom Address Option */}
            <TouchableOpacity
              style={[
                styles.locationOption,
                !useCurrentLocation && styles.locationOptionSelected,
              ]}
              onPress={() => setUseCurrentLocation(false)}
            >
              <MaterialIcons
                name={!useCurrentLocation ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={24}
                color={!useCurrentLocation ? colors.primary : '#666'}
              />
              <View style={styles.locationOptionContent}>
                <Text style={styles.locationOptionTitle}>Informar outro endereço</Text>
                <Text style={styles.locationHint}>Digite o endereço onde o serviço será realizado</Text>
              </View>
            </TouchableOpacity>

            {/* Custom Address Fields */}
            {!useCurrentLocation && (
              <View style={styles.addressFields}>
                <TextInput
                  label="Endereço"
                  value={customAddress}
                  onChangeText={setCustomAddress}
                  mode="outlined"
                  style={styles.input}
                  placeholder="Rua, número, bairro"
                />
                <View style={styles.addressRow}>
                  <TextInput
                    label="Cidade"
                    value={customCity}
                    onChangeText={setCustomCity}
                    mode="outlined"
                    style={[styles.input, styles.cityInput]}
                  />
                  <TextInput
                    label="Estado"
                    value={customState}
                    onChangeText={setCustomState}
                    mode="outlined"
                    style={[styles.input, styles.stateInput]}
                    maxLength={2}
                  />
                </View>
                <TextInput
                  label="CEP"
                  value={customZipCode}
                  onChangeText={setCustomZipCode}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="numeric"
                  maxLength={9}
                  placeholder="00000-000"
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.submitButton}
            labelStyle={styles.submitButtonLabel}
          >
            Publicar Projeto
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  form: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 12,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetInput: {
    flex: 1,
  },
  budgetSeparator: {
    marginHorizontal: 12,
    color: '#666',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingVertical: 8,
  },
  checkboxTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  checkboxHint: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
  },
  locationOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  locationOptionContent: {
    flex: 1,
    marginLeft: 12,
  },
  locationOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  locationHint: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 13,
  },
  addressFields: {
    marginTop: 8,
  },
  addressRow: {
    flexDirection: 'row',
  },
  cityInput: {
    flex: 2,
    marginRight: 12,
  },
  stateInput: {
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  submitButton: {
    paddingVertical: 8,
  },
  submitButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
