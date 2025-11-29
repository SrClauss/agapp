import React from 'react';
import { View, StyleSheet, Text, KeyboardAvoidingView, Platform, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
export default function ProfileSelectionScreen() {
  const navigation = useNavigation();
  const setActiveRole = useAuthStore((s: AuthState) => s.setActiveRole);

  const handleRoleSelection = (role: string) => {
    setActiveRole(role);
    // Navigate to the appropriate screen based on role
    const destination = role === 'client' ? 'WelcomeCustomer' : 'ProfessionalHome';
    navigation.navigate(destination as never);
  };

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBackground}
    >
      <KeyboardAvoidingView
        style={styles.centeredContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} />
            <Text style={styles.title}>Selecionar Perfil</Text>
            <Text style={styles.subtitle}>
              Você possui acesso a múltiplos perfis.{'\n'}
              Escolha como desejar continuar:
            </Text>
          </View>

          <View style={styles.cardsContainer}>
            <TouchableOpacity
              style={styles.profileCard}
              onPress={() => handleRoleSelection('client')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, styles.clientIconBg]}>
                <MaterialCommunityIcons name="account" size={38} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Cliente</Text>
              <Text style={styles.cardDescription}>
                Agendar serviços e gerenciar seus compromissos
              </Text>
              <View style={styles.arrowContainer}>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#4A90E2" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileCard}
              onPress={() => handleRoleSelection('professional')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, styles.professionalIconBg]}>
                <MaterialCommunityIcons name="briefcase" size={38} color="#fff" />
              </View>
              <Text style={styles.cardTitle}>Profissional</Text>
              <Text style={styles.cardDescription}>
                Oferecer serviços e gerenciar sua agenda
              </Text>
              <View style={styles.arrowContainer}>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#4A90E2" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '90%',
    maxWidth: 450,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 12,
    borderRadius: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardsContainer: {
    width: '100%',
    gap: 12,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 226, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  clientIconBg: {
    backgroundColor: '#4A90E2',
  },
  professionalIconBg: {
    backgroundColor: '#2ECC71',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  arrowContainer: {
    marginTop: 10,
    padding: 6,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderRadius: 16,
  },
});