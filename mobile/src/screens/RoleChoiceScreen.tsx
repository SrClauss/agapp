import React, { useState, useEffect } from 'react';
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
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RoleChoiceScreenNavigationProp = StackNavigationProp<RootStackParamList, 'RoleChoice'>;

interface RoleChoiceScreenProps {
  navigation: RoleChoiceScreenNavigationProp;
}

export default function RoleChoiceScreen({ navigation }: RoleChoiceScreenProps): React.JSX.Element {
  const [selectedRole, setSelectedRole] = useState<string>('client');
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    loadUserRoles();
  }, []);

  const loadUserRoles = async (): Promise<void> => {
    try {
      const rolesStr = await AsyncStorage.getItem('user_roles');
      if (rolesStr) {
        const roles = JSON.parse(rolesStr);
        setUserRoles(roles);
        // Set default to first role
        if (roles.length > 0) {
          setSelectedRole(roles[0]);
        }
      } else {
        // No roles stored, redirect to role selection
        navigation.replace('RoleSelection');
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const handleContinue = async (): Promise<void> => {
    if (!selectedRole) {
      Alert.alert('Erro', 'Selecione um tipo de acesso');
      return;
    }

    try {
      // Store active role
      await AsyncStorage.setItem('active_role', selectedRole);

      // Navigate to appropriate screen based on role
      if (selectedRole === 'client') {
        navigation.replace('ClientDashboard');
      } else if (selectedRole === 'professional') {
        navigation.replace('ProfessionalDashboard');
      } else {
        navigation.replace('Home');
      }
    } catch (error) {
      console.error('Error storing active role:', error);
      Alert.alert('Erro', 'Erro ao salvar preferência');
    }
  };

  const getRoleInfo = (role: string) => {
    if (role === 'client') {
      return {
        icon: '👤',
        title: 'Acessar como Cliente',
        description: 'Publique projetos e contrate profissionais',
      };
    } else if (role === 'professional') {
      return {
        icon: '🔧',
        title: 'Acessar como Profissional',
        description: 'Busque projetos e envie propostas',
      };
    }
    return {
      icon: '👤',
      title: role,
      description: '',
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Como deseja acessar?</Text>
          <Text style={styles.subtitle}>
            Você possui múltiplos perfis. Escolha como deseja usar o Agilizapp agora.
          </Text>
        </View>

        {/* Role Options */}
        {userRoles.map((role) => {
          const info = getRoleInfo(role);
          return (
            <Card
              key={role}
              style={[
                styles.card,
                selectedRole === role && styles.cardSelected
              ]}
              onPress={() => setSelectedRole(role)}
            >
              <Card.Content>
                <View style={styles.cardContent}>
                  <View style={styles.iconContainer}>
                    <Text style={styles.icon}>{info.icon}</Text>
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.cardTitle}>{info.title}</Text>
                    <Text style={styles.cardDescription}>{info.description}</Text>
                  </View>
                  <RadioButton
                    value={role}
                    status={selectedRole === role ? 'checked' : 'unchecked'}
                    onPress={() => setSelectedRole(role)}
                    color="#3471b9"
                  />
                </View>
              </Card.Content>
            </Card>
          );
        })}

        {/* Info */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text style={styles.infoText}>
              💡 Você pode alternar entre seus perfis a qualquer momento nas configurações.
            </Text>
          </Card.Content>
        </Card>

        {/* Continue Button */}
        <Button
          mode="contained"
          onPress={handleContinue}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Continuar
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
    marginTop: 40,
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
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e8f0ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    marginBottom: 16,
    backgroundColor: '#fff3e0',
    elevation: 0,
  },
  infoText: {
    fontSize: 14,
    color: '#e65100',
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
