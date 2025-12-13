import React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Divider, Card, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

import LocationAvatar from '../components/LocationAvatar';
import { BannerAd } from '../components/BannerAd';
import { colors } from '../theme/colors';

export default function ProfessionalHomeScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.container}
      >
        <LocationAvatar />

        <BannerAd adType="banner_professional" minHeight={90} maxHeight={200} />

        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>Meus Projetos</Text>

          <TouchableOpacity
            onPress={() => (navigation as any).navigate('ProjectsBySubcategory')}
          >
            <Card style={styles.menuCard}>
              <Card.Content style={styles.menuCardContent}>
                <Text style={styles.menuCardIcon}>📊</Text>
                <View style={styles.menuCardTextContainer}>
                  <Text style={styles.menuCardTitle}>Projetos Disponíveis</Text>
                  <Text style={styles.menuCardSubtitle}>
                    Ver projetos por subcategoria
                  </Text>
                </View>
                <Text style={styles.menuCardArrow}>›</Text>
              </Card.Content>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => (navigation as any).navigate('ProfessionalOptions')}
          >
            <Card style={styles.menuCard}>
              <Card.Content style={styles.menuCardContent}>
                <Text style={styles.menuCardIcon}>⚙️</Text>
                <View style={styles.menuCardTextContainer}>
                  <Text style={styles.menuCardTitle}>Minhas Subcategorias</Text>
                  <Text style={styles.menuCardSubtitle}>
                    Configurar áreas de atuação
                  </Text>
                </View>
                <Text style={styles.menuCardArrow}>›</Text>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  divider: {
    marginVertical: 24,
  },
  menuContainer: {
    marginTop: 24,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  menuCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  menuCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuCardIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  menuCardTextContainer: {
    flex: 1,
  },
  menuCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  menuCardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuCardArrow: {
    fontSize: 32,
    color: colors.textSecondary,
  },
});
