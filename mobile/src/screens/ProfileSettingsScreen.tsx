import React, { useEffect, useState } from 'react';
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
  Switch,
  Chip,
  TextInput,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, UserResponse } from '../services/api';

type ProfileSettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ProfileSettings'>;

interface ProfileSettingsScreenProps {
  navigation: ProfileSettingsScreenNavigationProp;
}

export default function ProfileSettingsScreen({ navigation }: ProfileSettingsScreenProps): React.JSX.Element {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Skills
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState<string>('');

  // Notification preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [matchSkills, setMatchSkills] = useState<boolean>(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const userData = await apiService.getCurrentUser(token);
      setUser(userData);

      // Load existing skills
      if (userData.skills) {
        setSkills(userData.skills);
      }

      // Load notification preferences
      if (userData.notification_preferences) {
        setNotificationsEnabled(userData.notification_preferences.enabled);
        setRadiusKm(userData.notification_preferences.radius_km);
        setMatchSkills(userData.notification_preferences.match_skills);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSkill = (): void => {
    const trimmedSkill = newSkill.trim();
    if (!trimmedSkill) {
      Alert.alert('Atenção', 'Digite uma habilidade');
      return;
    }

    if (skills.includes(trimmedSkill)) {
      Alert.alert('Atenção', 'Esta habilidade já foi adicionada');
      return;
    }

    setSkills([...skills, trimmedSkill]);
    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string): void => {
    setSkills(skills.filter(s => s !== skill));
  };

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      await apiService.updateUserProfile(token, {
        skills,
        notification_preferences: {
          enabled: notificationsEnabled,
          radius_km: radiusKm,
          match_skills: matchSkills,
        },
      });

      Alert.alert('Sucesso', 'Configurações salvas com sucesso!');
      navigation.goBack();
    } catch (error) {
      const errorMessage = (error as Error).message || 'Erro ao salvar configurações';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsSaving(false);
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
        {/* Header */}
        <View style={styles.header}>
          <Button
            mode="text"
            onPress={() => navigation.goBack()}
            icon="arrow-left"
            textColor="#3471b9"
          >
            Voltar
          </Button>
        </View>

        <Text style={styles.title}>Configurações de Perfil</Text>
        <Text style={styles.subtitle}>
          Configure suas habilidades e preferências de notificação
        </Text>

        {/* Skills Section */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Minhas Habilidades</Text>
            <Text style={styles.cardDescription}>
              Adicione habilidades para receber notificações de projetos relevantes
            </Text>

            {/* Add skill input */}
            <View style={styles.addSkillRow}>
              <TextInput
                label="Nova habilidade"
                value={newSkill}
                onChangeText={setNewSkill}
                mode="outlined"
                style={styles.skillInput}
                placeholder="Ex: React Native, Design, Elétrica..."
                onSubmitEditing={handleAddSkill}
              />
              <Button
                mode="contained"
                onPress={handleAddSkill}
                style={styles.addButton}
                icon="plus"
              >
                Adicionar
              </Button>
            </View>

            {/* Skills chips */}
            {skills.length > 0 ? (
              <View style={styles.skillsContainer}>
                {skills.map((skill) => (
                  <Chip
                    key={skill}
                    onClose={() => handleRemoveSkill(skill)}
                    style={styles.skillChip}
                  >
                    {skill}
                  </Chip>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Nenhuma habilidade adicionada ainda
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Notification Preferences */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Notificações de Projetos</Text>
            <Text style={styles.cardDescription}>
              Receba notificações quando novos projetos forem publicados
            </Text>

            {/* Enable notifications toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Ativar Notificações</Text>
                <Text style={styles.settingDescription}>
                  Receba alertas de novos projetos
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                color="#3471b9"
              />
            </View>

            {notificationsEnabled && (
              <>
                {/* Radius selection */}
                <View style={styles.settingSection}>
                  <Text style={styles.settingLabel}>Raio de Notificação</Text>
                  <Text style={styles.settingDescription}>
                    Receba notificações de projetos em um raio de {radiusKm}km
                  </Text>
                  <View style={styles.radiusButtons}>
                    {[5, 10, 25, 50, 100].map((radius) => (
                      <Chip
                        key={radius}
                        selected={radiusKm === radius}
                        onPress={() => setRadiusKm(radius)}
                        style={[
                          styles.radiusChip,
                          radiusKm === radius && styles.radiusChipSelected,
                        ]}
                      >
                        {radius}km
                      </Chip>
                    ))}
                  </View>
                </View>

                {/* Match skills toggle */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Filtrar por Habilidades</Text>
                    <Text style={styles.settingDescription}>
                      Apenas projetos que combinem com suas habilidades
                    </Text>
                  </View>
                  <Switch
                    value={matchSkills}
                    onValueChange={setMatchSkills}
                    color="#3471b9"
                  />
                </View>

                {matchSkills && skills.length === 0 && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      ⚠️ Adicione habilidades para receber notificações filtradas
                    </Text>
                  </View>
                )}
              </>
            )}
          </Card.Content>
        </Card>

        {/* Save button */}
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          loading={isSaving}
          disabled={isSaving}
          icon="content-save"
        >
          Salvar Configurações
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
    marginBottom: 8,
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
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  addSkillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  skillInput: {
    flex: 1,
  },
  addButton: {
    justifyContent: 'center',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    backgroundColor: '#e3f2fd',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
  },
  settingSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  radiusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  radiusChip: {
    backgroundColor: '#f5f5f5',
  },
  radiusChipSelected: {
    backgroundColor: '#3471b9',
  },
  warningBox: {
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    fontSize: 13,
    color: '#e65100',
  },
  saveButton: {
    marginTop: 8,
    marginBottom: 24,
  },
});
