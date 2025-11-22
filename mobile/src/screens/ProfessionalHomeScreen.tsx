import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdBanner from '../components/AdBanner';
import { colors } from '../theme/colors';

export default function ProfessionalHomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Ad Banner at the top */}
        <View style={styles.bannerContainer}>
          <AdBanner location="banner_professional_home" />
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <Text style={styles.title}>Bem-vindo, Profissional!</Text>
          <Text style={styles.subtitle}>
            Encontre novos projetos e amplie sua carteira de clientes
          </Text>

          {/* Placeholder content - you can add your actual content here */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Projetos Disponíveis</Text>
            <Text style={styles.cardText}>Veja projetos próximos a você</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Meus Projetos</Text>
            <Text style={styles.cardText}>Gerencie seus projetos em andamento</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Minha Agenda</Text>
            <Text style={styles.cardText}>Organize seus compromissos</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Perfil</Text>
            <Text style={styles.cardText}>Atualize suas informações e portfolio</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  bannerContainer: {
    padding: 16,
    paddingTop: 8,
  },
  mainContent: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
