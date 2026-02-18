import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, FAB, Button } from 'react-native-paper';
import { colors } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';
import LocationAvatar from '../components/LocationAvatar';
import NearbySummary from '../components/NearbySummary';
import { BannerAd } from '../components/BannerAd';
import ProfessionalStatsCard from '../components/ProfessionalStatsCard';
import { useLocationStore } from '../stores/locationStore';
import useProjectsNearbyStore from '../stores/projectsNearbyStore';
import useAuthStore, { AuthState } from '../stores/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


export default function WelcomeProfessionalScreen() {

  const coords = useLocationStore((s) => s.coords);
  const fetchNearby = useProjectsNearbyStore((s) => s.fetchProjectsNearby);
  const projectsNearby = useProjectsNearbyStore((s) => s.projectsNearby);
  const projectsAll = useProjectsNearbyStore((s) => s.projectsAll);
  const projectsNonRemote = useProjectsNearbyStore((s) => s.projectsNonRemote);
  const loading = useProjectsNearbyStore((s) => s.loading);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s: AuthState) => s.logout);
  const navigation = useNavigation();

  const handleLogout = async () => {
    try {
      await logout();
      navigation.navigate('Login' as never);
    } catch (err) {
      console.warn('Logout falhou', err);
    }
  };

  // Fetch nearby projects when screen is focused or coords change
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        // If we have coords, fetch using them; otherwise fetch with token (backend will fallback to professional settings)
        if (coords) {
          await fetchNearby({ token: token ?? undefined, latitude: coords[1], longitude: coords[0] });
        } else {
          await fetchNearby({ token: token ?? undefined });
        }
      })();

      return () => {
        mounted = false;
      };
    }, [coords, token, fetchNearby])
  );

  return (

    <SafeAreaView style={styles.safeArea}  >
      <ScrollView >

        <View style={styles.containerView}>
          <LocationAvatar />

          <View style={styles.sectionContainer}>
            <BannerAd adType='banner_professional' />
          </View>
          <View style={styles.sectionContainer}>
            <NearbySummary />
          </View>

          <View style={styles.sectionContainer}>
            {/* Professional stats card */}
            <ProfessionalStatsCard />
            <View style={{ marginTop: 10 }}>
              <Button mode="outlined" onPress={() => (navigation as any).navigate('ContactedProjects')}>Projetos que contatei</Button>
              <Button mode="outlined" onPress={() => (navigation as any).navigate('EditProfessionalSettings')}>Editar categorias</Button>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <Button
              mode="contained"
              onPress={handleLogout}
            >Sair</Button>
          </View>



        </View>
      </ScrollView>
    </SafeAreaView>

  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    marginHorizontal: 15,


  },
  containerView: {
    flex: 1,
    marginBottom: 50,
  },
  
  actionButtons: {
    flexDirection: 'column',
    marginTop: 10,
    gap: 10,
  },
  sectionContainer: {
    marginTop: 20,
  },
});