import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  RadioButton,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

type RoleSelectionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'RoleSelection'>;
type RoleSelectionScreenRouteProp = RouteProp<RootStackParamList, 'RoleSelection'>;

interface RoleSelectionScreenProps {
  navigation: RoleSelectionScreenNavigationProp;
  route: RoleSelectionScreenRouteProp;
}

export default function RoleSelectionScreen({ navigation, route }: RoleSelectionScreenProps): React.JSX.Element {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['client']);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const toggleRole = (role: string): void => {
    if (selectedRoles.includes(role)) {
      // Remove role if already selected (but keep at least one)
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter(r => r !== role));
      }
    } else {
      // Add role
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleContinue = async (): Promise<void> => {
    if (selectedRoles.length === 0) {
      Alert.alert('Erro', 'Selecione pelo menos um tipo de perfil');
      return;
    }

    setIsLoading(true);

    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      console.log('RoleSelection - Updating backend with roles:', selectedRoles);

      // Update user roles in the backend
      await apiService.updateUserRoles(token, selectedRoles);

      console.log('RoleSelection - Backend updated successfully');

      // Store selected roles locally
      await AsyncStorage.setItem('user_roles', JSON.stringify(selectedRoles));

      console.log('RoleSelection - Saved roles locally:', selectedRoles);

      // If user has multiple roles, go to role choice screen
      if (selectedRoles.length > 1) {
        console.log('RoleSelection - Going to RoleChoice');
        navigation.replace('RoleChoice');
      } else {
        // Store active role
        await AsyncStorage.setItem('active_role', selectedRoles[0]);
        console.log('RoleSelection - Going to Home with role:', selectedRoles[0]);
        navigation.replace('Home');
      }
    } catch (error) {
      console.error('Error updating roles:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Escolha seu perfil</Text>
          <Text style={styles.subtitle}>
            Selecione como você deseja usar o Agilizapp. Você pode escolher ambos e alternar entre eles quando quiser!
          </Text>
        </View>

        {/* Client Option */}
        <Card
          style={[
            styles.card,
            selectedRoles.includes('client') && styles.cardSelected
          ]}
          onPress={() => toggleRole('client')}
        >
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>👤</Text>
              </View>
              <RadioButton
                value="client"
                status={selectedRoles.includes('client') ? 'checked' : 'unchecked'}
                onPress={() => toggleRole('client')}
                color="#3471b9"
              />
            </View>
            <Text style={styles.cardTitle}>Sou Cliente</Text>
            <Text style={styles.cardDescription}>
              Quero contratar profissionais para meus projetos e demandas.
            </Text>
            <View style={styles.features}>
              <Text style={styles.feature}>• Publicar projetos</Text>
              <Text style={styles.feature}>• Contratar profissionais</Text>
              <Text style={styles.feature}>• Gerenciar orçamentos</Text>
              <Text style={styles.feature}>• Avaliar serviços</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Professional Option */}
        <Card
          style={[
            styles.card,
            selectedRoles.includes('professional') && styles.cardSelected
          ]}
          onPress={() => toggleRole('professional')}
        >
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>🔧</Text>
              </View>
              <RadioButton
                value="professional"
                status={selectedRoles.includes('professional') ? 'checked' : 'unchecked'}
                onPress={() => toggleRole('professional')}
                color="#3471b9"
              />
            </View>
            <Text style={styles.cardTitle}>Sou Profissional</Text>
            <Text style={styles.cardDescription}>
              Quero oferecer meus serviços e encontrar novos clientes.
            </Text>
            <View style={styles.features}>
              <Text style={styles.feature}>• Buscar projetos</Text>
              <Text style={styles.feature}>• Enviar propostas</Text>
              <Text style={styles.feature}>• Receber avaliações</Text>
              <Text style={styles.feature}>• Gerenciar portfólio</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Info */}
        {selectedRoles.length === 2 && (
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text style={styles.infoText}>
                ✨ Você selecionou ambos os perfis! A cada login, você poderá escolher
                como deseja acessar a plataforma.
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Continue Button */}
        <Button
          mode="contained"
          onPress={handleContinue}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          disabled={isLoading || selectedRoles.length === 0}
          loading={isLoading}
        >
          {isLoading ? 'Salvando...' : 'Continuar'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#fff',
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#3471b9',
    backgroundColor: '#f0f7ff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e8f0ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 32,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  features: {
    marginTop: 8,
  },
  feature: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  infoCard: {
    marginBottom: 16,
    backgroundColor: '#e8f5e9',
    elevation: 0,
  },
  infoText: {
    fontSize: 14,
    color: '#2e7d32',
    lineHeight: 20,
  },
  button: {
    borderRadius: 8,
    elevation: 2,
    backgroundColor: '#3471b9',
    marginTop: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
