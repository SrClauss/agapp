import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  ActivityIndicator,
  Chip,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { addressService, Address } from '../services/address';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

type AddressSearchScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AddressSearch'>;
type AddressSearchScreenRouteProp = RouteProp<RootStackParamList, 'AddressSearch'>;

interface AddressSearchScreenProps {
  navigation: AddressSearchScreenNavigationProp;
  route: AddressSearchScreenRouteProp;
}

export default function AddressSearchScreen({ navigation, route }: AddressSearchScreenProps): React.JSX.Element {
  const [searchType, setSearchType] = useState<'cep' | 'address'>('cep');
  const [cep, setCep] = useState<string>('');
  const [uf, setUf] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [street, setStreet] = useState<string>('');
  const [results, setResults] = useState<Address[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Validate that we have the callback
  useEffect(() => {
    if (!route.params?.onSelect) {
      console.error('AddressSearchScreen: onSelect callback is missing');
      Alert.alert('Erro', 'Configuração inválida da tela de busca', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  }, []);

  const handleSearchByCEP = async (): Promise<void> => {
    if (!cep.trim()) {
      setError('Digite um CEP');
      return;
    }

    setIsSearching(true);
    setError('');
    setResults([]);

    try {
      const result = await addressService.searchByCEP(cep);
      if (result) {
        setResults([result]);
      } else {
        setError('CEP não encontrado');
      }
    } catch (err: any) {
      console.error('Error searching by CEP:', err);
      setError(err.message || 'Erro ao buscar CEP. Verifique sua conexão.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchByAddress = async (): Promise<void> => {
    if (!uf.trim() || !city.trim() || !street.trim()) {
      setError('Preencha UF, cidade e logradouro');
      return;
    }

    setIsSearching(true);
    setError('');
    setResults([]);

    try {
      const searchResults = await addressService.searchByAddress(uf, city, street);
      if (searchResults.length > 0) {
        setResults(searchResults);
      } else {
        setError('Nenhum endereço encontrado');
      }
    } catch (err: any) {
      console.error('Error searching by address:', err);
      setError(err.message || 'Erro ao buscar endereço. Verifique sua conexão.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectAddress = (address: Address): void => {
    try {
      // Retorna o endereço selecionado para a tela anterior
      if (route.params?.onSelect) {
        route.params.onSelect(address.formattedAddress);
      }
      navigation.goBack();
    } catch (err: any) {
      console.error('Error selecting address:', err);
      setError('Erro ao selecionar endereço. Tente novamente.');
    }
  };

  const formatCEPInput = (text: string): void => {
    const clean = text.replace(/\D/g, '');
    if (clean.length <= 8) {
      if (clean.length > 5) {
        setCep(`${clean.slice(0, 5)}-${clean.slice(5)}`);
      } else {
        setCep(clean);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Buscar Endereço</Text>
            <Text style={styles.subtitle}>
              Encontre seu endereço por CEP ou pesquise por logradouro
            </Text>
          </View>

          {/* Search Type Selector */}
          <View style={styles.tabContainer}>
            <Chip
              selected={searchType === 'cep'}
              onPress={() => setSearchType('cep')}
              style={[styles.tab, searchType === 'cep' && styles.tabActive]}
              textStyle={searchType === 'cep' ? styles.tabTextActive : styles.tabText}
            >
              Buscar por CEP
            </Chip>
            <Chip
              selected={searchType === 'address'}
              onPress={() => setSearchType('address')}
              style={[styles.tab, searchType === 'address' && styles.tabActive]}
              textStyle={searchType === 'address' ? styles.tabTextActive : styles.tabText}
            >
              Buscar por Logradouro
            </Chip>
          </View>

          {/* Search Form */}
          <Card style={styles.card}>
            <Card.Content>
              {searchType === 'cep' ? (
                <>
                  <TextInput
                    label="CEP"
                    value={cep}
                    onChangeText={formatCEPInput}
                    mode="outlined"
                    keyboardType="numeric"
                    placeholder="00000-000"
                    maxLength={9}
                    style={styles.input}
                  />
                  <Button
                    mode="contained"
                    onPress={handleSearchByCEP}
                    loading={isSearching}
                    disabled={isSearching}
                    style={styles.searchButton}
                  >
                    Buscar
                  </Button>
                </>
              ) : (
                <>
                  <TextInput
                    label="UF"
                    value={uf}
                    onChangeText={(text) => setUf(text.toUpperCase())}
                    mode="outlined"
                    placeholder="SP"
                    maxLength={2}
                    style={styles.input}
                    autoCapitalize="characters"
                  />
                  <TextInput
                    label="Cidade"
                    value={city}
                    onChangeText={setCity}
                    mode="outlined"
                    placeholder="São Paulo"
                    style={styles.input}
                  />
                  <TextInput
                    label="Logradouro"
                    value={street}
                    onChangeText={setStreet}
                    mode="outlined"
                    placeholder="Avenida Paulista"
                    style={styles.input}
                  />
                  <Button
                    mode="contained"
                    onPress={handleSearchByAddress}
                    loading={isSearching}
                    disabled={isSearching}
                    style={styles.searchButton}
                  >
                    Buscar
                  </Button>
                </>
              )}
            </Card.Content>
          </Card>

          {/* Error Message */}
          {error ? (
            <Card style={styles.errorCard}>
              <Card.Content>
                <Text style={styles.errorText}>{error}</Text>
              </Card.Content>
            </Card>
          ) : null}

          {/* Loading */}
          {isSearching && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Buscando...</Text>
            </View>
          )}

          {/* Results */}
          {results.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>
                {results.length === 1 ? 'Endereço encontrado:' : `${results.length} endereços encontrados:`}
              </Text>
              {results.map((address, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleSelectAddress(address)}
                  activeOpacity={0.7}
                >
                  <Card style={styles.resultCard}>
                    <Card.Content>
                      <Text style={styles.addressText}>{address.logradouro}</Text>
                      <Text style={styles.addressDetail}>
                        {address.bairro} - {address.localidade}/{address.uf}
                      </Text>
                      <Text style={styles.addressCep}>CEP: {addressService.formatCEP(address.cep)}</Text>
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Manual Entry */}
          <Divider style={styles.divider} />
          <Button
            mode="text"
            onPress={() => {
              if (route.params?.onSelect) {
                route.params.onSelect('');
              }
              navigation.goBack();
            }}
            style={styles.manualButton}
          >
            Digitar endereço manualmente
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.base,
  },
  tab: {
    flex: 1,
    backgroundColor: colors.white,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  card: {
    backgroundColor: colors.white,
    ...shadows.base,
    marginBottom: spacing.base,
  },
  input: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  searchButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  errorCard: {
    backgroundColor: '#ffebee',
    ...shadows.none,
    marginBottom: spacing.base,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: typography.fontSize.base,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: spacing.base,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  resultsContainer: {
    marginTop: spacing.sm,
  },
  resultsTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  resultCard: {
    backgroundColor: colors.white,
    ...shadows.base,
    marginBottom: spacing.md,
  },
  addressText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  addressDetail: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  addressCep: {
    fontSize: typography.fontSize.sm,
    color: colors.textDisabled,
  },
  divider: {
    marginVertical: 24,
  },
  manualButton: {
    marginBottom: spacing.base,
  },
});
