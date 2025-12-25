import React, { useState, useEffect, use } from 'react';
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
import axios from 'axios';
import { createProject, updateProject, ProjectCreateData, ProjectLocation, GeocodedAddress, Project } from '../api/projects';
import useAuthStore from '../stores/authStore';
import { colors } from '../theme/colors';
import { MAX_PROJECT_TITLE_LENGTH } from '../constants';

import MapPinPicker from '../components/MapPinPicker';
import AddressSearch from '../components/AddressSearch';
interface RouteParams {
  categoryName: string;
  subcategoryName: string;
  defaultRemoteExecution?: boolean;
  project?: Project;
}

interface CreateProjectProps {
  overrideParams?: RouteParams;
}

export default function CreateProjectScreen({ overrideParams }: CreateProjectProps) {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (overrideParams ?? route.params) as RouteParams;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [remoteExecution, setRemoteExecution] = useState(params?.defaultRemoteExecution || false);
  
  // Location state
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [currentAddressData, setCurrentAddressData] = useState<{
    street?: string;
    number?: string;
    district?: string;
    complement?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    reference?: string;
  } | null>(null);
  const [currentAddressFormatted, setCurrentAddressFormatted] = useState('');
  const [cepSearching, setCepSearching] = useState(false);
  const [tempGeocode, setTempGeocode] = useState<{
    address?: string;
    coordinates?: [number, number];
    provider?: string;
    raw?: any;
  } | null>(null);
  // confirmedLocation will hold the geocoded address (LocationGeocodedAddress)
  const [confirmedLocation, setConfirmedLocation] = useState<GeocodedAddress | null>(null);
  const [confirmedCoordinates, setConfirmedCoordinates] = useState<{ type: 'Point'; coordinates: [number, number] } | null>(null);
  
  // Edit address inline state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  
  // Loading states
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {

    console.log("Current location:", currentLocation)
    },[currentLocation])   // Fetch current location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Preencher campos se for edição
  useEffect(() => {
    if (params.project) {
      setTitle(params.project.title || '');
      setDescription(params.project.description || '');
      setBudgetMin(params.project.budget_min?.toString() || '');
      setBudgetMax(params.project.budget_max?.toString() || '');
      setRemoteExecution(params.project.remote_execution || false);
      
      // Preencher localização se houver
      if (params.project.location) {
        if (params.project.location.coordinates) {
          const coords = params.project.location.coordinates;
          const [lng, lat] = Array.isArray(coords) ? coords : coords.coordinates;
          setCurrentLocation({ latitude: lat, longitude: lng });
        }
        if (params.project.location.address) {
          const addr = params.project.location.address;
          if (typeof addr === 'object' && 'formatted' in addr) {
            setCurrentAddressFormatted(addr.formatted || '');
            setCurrentAddressData({
              street: addr.formatted || '',
              number: (addr as any).number || '',
              district: (addr as any).district || '',
              complement: (addr as any).complement || '',
              city: addr.city || '',
              region: addr.region || '',
              postalCode: addr.postalCode || '',
              country: (addr as any).country || '',
              reference: (addr as any).reference || '',
            });
          }
        }
      }
    }
  }, [params.project]);

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

      // Store geocoded data for editing
      const addressData = geocoded ? {
        street: geocoded.street || undefined,
        number: geocoded.streetNumber || undefined,
        district: geocoded.district || undefined,
        city: geocoded.city || geocoded.subregion || undefined,
        region: geocoded.region || undefined,
        postalCode: geocoded.postalCode || undefined,
        country: geocoded.country || undefined,
      } : null;

      // Create formatted address string
      const formattedAddress = geocoded ? 
        `${geocoded.street || ''}${geocoded.streetNumber ? ', ' + geocoded.streetNumber : ''}${geocoded.district ? ' - ' + geocoded.district : ''}, ${geocoded.city || geocoded.subregion || ''} - ${geocoded.region || ''}, ${geocoded.postalCode || ''}${geocoded.country ? ', ' + geocoded.country : ''}`.replace(/, ,/g, ',').replace(/^,|,$/g, '').trim()
        : 'Endereço não disponível';

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setCurrentAddressData(addressData);
      setCurrentAddressFormatted(formattedAddress);
    } catch (error) {
      console.warn('Erro ao obter localização:', error);
      Alert.alert('Erro', 'Não foi possível obter sua localização atual.');
    } finally {
      setLoadingLocation(false);
    }
  };

    // Helper: format a ProjectAddress (geocoded object or custom) into a single display string
    // Note: LocationGeocodedAddress includes a formatted address. Use
    // `location.formatted` or `location.name`/`location.display_name` directly.

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Erro', 'Por favor, informe um título para o projeto.');
      return false;
    }
    if (title.trim().length > MAX_PROJECT_TITLE_LENGTH) {
      Alert.alert('Erro', `O título do projeto deve ter no máximo ${MAX_PROJECT_TITLE_LENGTH} caracteres.`);
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Erro', 'Por favor, descreva o que você precisa.');
      return false;
    }
    // If non-remote, require location
    if (!remoteExecution && !currentLocation) {
      Alert.alert('Erro', 'Localização atual é necessária para projetos presenciais.');
      return false;
    }
    return true;
  };

  const handleEditCurrentLocation = () => {
    if (!currentLocation || !currentAddressFormatted) {
      Alert.alert('Erro', 'Localização atual não disponível para edição.');
      return;
    }
    setIsEditingAddress(!isEditingAddress);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Make sure user is authenticated
    const token = useAuthStore.getState().token;
    if (!token) {
      Alert.alert('Autenticação requerida', 'Você precisa entrar para publicar um projeto.');
      navigation.navigate('Login' as never);
      return;
    }

    try {
      setSubmitting(true);

      // Build location object with proper typing
      const location: ProjectLocation = {};
      
      if (currentLocation) {
        location.coordinates = [currentLocation.longitude, currentLocation.latitude];
        location.address = {
          formatted: currentAddressFormatted,
          ...(currentAddressData?.city && { city: currentAddressData.city }),
          ...(currentAddressData?.region && { region: currentAddressData.region }),
          ...(currentAddressData?.postalCode && { postalCode: currentAddressData.postalCode }),
          ...(currentAddressData?.number && { number: currentAddressData.number }),
          ...(currentAddressData?.complement && { complement: currentAddressData.complement }),
          ...(currentAddressData?.district && { district: currentAddressData.district }),
        } as any;
      }

      // Build project data
      const projectData: ProjectCreateData = {
        title: title.trim(),
        description: description.trim(),
        category: params.project ? (typeof params.project.category === 'string' ? { main: params.project.category, sub: '' } : params.project.category) : {
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

      // Create or update the project
      let project: Project;
      if (params.project) {
        // Resolve project id (support both id and _id from different sources)
        const resolvedId = (params.project as any).id || (params.project as any)._id;
        if (__DEV__) {
          console.log('[CreateProjectScreen] Editing project param:', params.project, 'resolvedId=', resolvedId);
        }
        if (!resolvedId) {
          Alert.alert('Erro', 'ID do projeto ausente. Não é possível atualizar.');
          throw new Error('missing project id');
        }
        project = await updateProject(resolvedId, projectData);
      } else {
        project = await createProject(projectData);
      }

      Alert.alert(
        params.project ? 'Projeto Atualizado!' : 'Projeto Criado!',
        params.project 
          ? 'Seu projeto foi atualizado com sucesso.'
          : 'Seu projeto foi criado com sucesso. Profissionais da região poderão entrar em contato.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (params.project) {
                // Go to project detail after update
                navigation.navigate('ProjectDetail' as never, { projectId: project.id } as never);
              } else {
                navigation.navigate('WelcomeCustomer' as never);
              }
            },
          },
        ]
      );
    } catch (error: unknown) {
      console.error('Erro ao criar projeto:', error);
      // Additional debug logs for axios errors
      if (axios.isAxiosError(error)) {
        console.error('[createProject] axios error status:', error.response?.status);
        console.error('[createProject] axios error data:', error.response?.data);
        console.error('[createProject] axios error headers:', error.response?.headers);
      }

      let message = 'Não foi possível criar o projeto. Tente novamente.';
      if (axios.isAxiosError(error) && error.response?.data) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          // try to find title error
          const titleError = detail.find((d: any) => d?.loc?.includes('title') || (d?.msg && d.msg.includes('title')));
          if (titleError) {
            message = `O título do projeto deve ter no máximo ${MAX_PROJECT_TITLE_LENGTH} caracteres.`;
          } else if (detail.length > 0 && typeof detail[0] === 'string') {
            message = detail[0];
          } else if (detail.length > 0 && detail[0].msg) {
            message = detail[0].msg;
          }
        } else if (typeof detail === 'string') {
          message = detail;
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
              <Text style={styles.headerTitle}>{params?.project ? 'Editar Projeto' : 'Criar Projeto'}</Text>
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
              maxLength={MAX_PROJECT_TITLE_LENGTH}
              style={styles.input}
              placeholder="Ex: Conserto de torneira vazando"
            />
            <Text style={styles.charCounter}>{title.length}/{MAX_PROJECT_TITLE_LENGTH}</Text>

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
            
            {/* Current Location */}
            <View style={styles.locationOption}>
              <MaterialIcons
                name="location-on"
                size={24}
                color={colors.primary}
              />
              <View style={styles.locationOptionContent}>
                <View style={styles.locationOptionHeader}>
                  <Text style={styles.locationOptionTitle}>Localização atual</Text>
                  {currentLocation && !loadingLocation && (
                    <TouchableOpacity onPress={handleEditCurrentLocation} style={styles.editButton}>
                      <MaterialIcons name={isEditingAddress ? "close" : "edit"} size={20} color={colors.primary} />
                      <Text style={styles.editButtonText}>{isEditingAddress ? "Fechar" : "Editar"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {loadingLocation ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Obtendo localização...</Text>
                  </View>
                ) : currentLocation ? (
                  <View style={styles.locationInfoContainer}>
                    <Text style={styles.locationAddressFormatted}>{currentAddressFormatted}</Text>
                    <View style={styles.coordinatesContainer}>
                      <Text style={styles.locationCoordinates}>φ:{currentLocation.latitude.toFixed(4)}, λ:{currentLocation.longitude.toFixed(4)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.locationHint}>Toque para obter sua localização</Text>
                )}
              </View>
            </View>

            {/* Edit Address Inline */}
            {isEditingAddress && currentLocation && (
              <View style={styles.editAddressContainer}>
                
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    label="Endereço"
                    value={currentAddressData?.street || ''}
                    onChangeText={(text) => setCurrentAddressData(prev => ({ ...prev, street: text }))}
                    mode="outlined"
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Rua, logradouro"
                  />
             
                </View>
                <View style={styles.addressRow}>
                  <TextInput
                    label="Número (opcional)"
                    value={currentAddressData?.number || ''}
                    onChangeText={(text) => setCurrentAddressData(prev => ({ ...prev, number: text }))}
                    mode="outlined"
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    keyboardType="numeric"
                  />
                  <TextInput
                    label="Complemento (opcional)"
                    value={currentAddressData?.complement || ''}
                    onChangeText={(text) => setCurrentAddressData(prev => ({ ...prev, complement: text }))}
                    mode="outlined"
                    style={[styles.input, { flex: 1 }]}
                  />
                </View>
                <TextInput
                  label="Bairro"
                  value={currentAddressData?.district || ''}
                  onChangeText={(text) => setCurrentAddressData(prev => ({ ...prev, district: text }))}
                  mode="outlined"
                  style={styles.input}
                />
                <View style={styles.addressRow}>
                  <TextInput
                    label="Cidade"
                    value={currentAddressData?.city || ''}
                    onChangeText={(text) => setCurrentAddressData(prev => ({ ...prev, city: text }))}
                    mode="outlined"
                    style={[styles.input, styles.cityInput]}
                  />
                  <TextInput
                    label="Estado"
                    value={currentAddressData?.region || ''}
                    onChangeText={(text) => setCurrentAddressData(prev => ({ ...prev, region: text }))}
                    mode="outlined"
                    style={[styles.input, styles.stateInput]}
                    maxLength={2}
                  />
                </View>
                <TextInput
                  label="CEP"
                  value={currentAddressData?.postalCode || ''}
                  onChangeText={(text) => setCurrentAddressData(prev => ({ ...prev, postalCode: text }))}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="numeric"
                />
                <TextInput
                  label="Ponto de referência (opcional)"
                  value={currentAddressData?.reference || ''}
                  onChangeText={(text) => setCurrentAddressData(prev => ({ ...prev, reference: text }))}
                  mode="outlined"
                  style={styles.input}
                />
                <Button mode="contained" onPress={() => setShowAddressSearch(true)} icon="magnify" style={{ alignSelf: 'stretch' }}>
                    Buscar
                 </Button>

                {/* Map Button */}
                <Button
                  mode="outlined"
                  onPress={() => setShowMapModal(true)}
                  icon={() => <MaterialIcons name="travel-explore" size={18} color={colors.primary} />}
                  style={{ marginTop: 8 }}
                >
                  Abrir mapa
                </Button>

                {/* Action Buttons */}
                <View style={styles.editActions}>
                  <Button style={styles.buttonEdit} mode='outlined'  onPress={() => setIsEditingAddress(false)}>Cancelar</Button>
                  <Button style={styles.buttonEdit}  mode="contained" onPress={() => {
                    // Update formatted address
                    const updatedData = currentAddressData;
                    const newFormatted = `${updatedData?.street || ''}${updatedData?.number ? ', ' + updatedData.number : ''}${updatedData?.district ? ' - ' + updatedData.district : ''}, ${updatedData?.city || ''} - ${updatedData?.region || ''}, ${updatedData?.postalCode || ''}`.replace(/, ,/g, ',').replace(/^,|,$/g, '').trim();
                    setCurrentAddressFormatted(newFormatted);
                    setIsEditingAddress(false);
                  }}>Salvar</Button>
                </View>
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
            {params?.project ? 'Atualizar Projeto' : 'Publicar Projeto'}
          </Button>
        </View>
      </KeyboardAvoidingView>

      {/* Address search modal */}
      <AddressSearch
        visible={showAddressSearch}
        initialCity={currentAddressData?.city}
        initialUF={currentAddressData?.region}
        onDismiss={() => setShowAddressSearch(false)}
        onSelect={(addr) => {
          // Update coordinates if available
          if ((addr as any).latitude && (addr as any).longitude) {
            setCurrentLocation({ latitude: (addr as any).latitude, longitude: (addr as any).longitude });
          }

          // Populate address fields from selected address
          setCurrentAddressData(prev => ({
            street: (addr as any).street || (addr as any).name || addr.formatted || prev?.street || '',
            number: (addr as any).number || prev?.number || '',
            district: (addr as any).district || prev?.district || '',
            complement: (addr as any).complement || prev?.complement || '',
            city: (addr as any).city || (addr as any).subregion || prev?.city || '',
            region: (addr as any).region || prev?.region || '',
            postalCode: (addr as any).postalCode || prev?.postalCode || '',
            country: (addr as any).country || prev?.country || '',
            reference: prev?.reference || ''
          } as any));

          setCurrentAddressFormatted((addr as any).formatted || (addr as any).display_name || (addr as any).name || '');
          setShowAddressSearch(false);
          setIsEditingAddress(true);
        }}
      />

      {/* Map Modal */}
      <MapPinPicker
        visible={showMapModal}
        initialCoords={currentLocation || undefined}
        onDismiss={() => setShowMapModal(false)}
        onConfirm={async (coords) => {
          setCurrentLocation(coords);
          setShowMapModal(false);
          
          // Reverse geocode to update address
          try {
            const addresses = await Location.reverseGeocodeAsync(coords);
            if (addresses.length > 0) {
              const addr = addresses[0];
              const addressData = {
                street: addr.street || addr.name || '',
                number: addr.streetNumber || '',
                district: addr.district || '',
                complement: '',
                city: addr.subregion || addr.city || '',
                region: addr.region || '',
                postalCode: addr.postalCode || '',
                country: addr.country || '',
                reference: '',
              };
              const formattedAddress = `${addressData.street}${addressData.number ? ', ' + addressData.number : ''}${addressData.district ? ' - ' + addressData.district : ''}, ${addressData.city} - ${addressData.region}, ${addressData.postalCode}`.replace(/, ,/g, ',').replace(/^,|,$/g, '').trim();
              
              setCurrentAddressData(addressData);
              setCurrentAddressFormatted(formattedAddress);
            }
          } catch (error) {
            console.warn('Reverse geocode failed:', error);
          }
        }}
      />
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
  buttonEdit:{
    width: '47.5%'  
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
  charCounter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -12,
    marginBottom: 8,
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
  editAddressContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  editActions: {

    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  locationOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: `${colors.primary}10`,
  },
  editButtonText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  locationAddressFormatted: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'left',
  },
  locationCoordinates: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  locationInfoContainer: {
    marginTop: 8,
  },
  coordinatesContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
});
