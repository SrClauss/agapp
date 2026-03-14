import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, FAB, Button } from 'react-native-paper';
import { colors } from '../theme/colors';
import { useNavigation, CommonActions } from '@react-navigation/native';
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
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';


export default function WelcomeProfessionalScreen() {

  const coords = useLocationStore((s) => s.coords);
  const fetchNearby = useProjectsNearbyStore((s) => s.fetchProjectsNearby);
  const projectsNearby = useProjectsNearbyStore((s) => s.projectsNearby);
  const projectsAll = useProjectsNearbyStore((s) => s.projectsAll);
  const projectsNonRemote = useProjectsNearbyStore((s) => s.projectsNonRemote);
  const loading = useProjectsNearbyStore((s) => s.loading);
  // token is read inside fetchProjectsNearby via authStore — no need to pass it explicitly
  const logout = useAuthStore((s: AuthState) => s.logout);
  const navigation = useNavigation();

  const handleLogout = async () => {
    try {
      await logout();
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
      );
    } catch (err) {
      console.warn('Logout falhou', err);
    }
  };

  // Fetch nearby projects when screen is focused or coords change.
  // NOTE: do NOT include `token` in the deps — `fetchProjectsNearby` already reads
  // the latest token from authStore internally, so adding `token` here would cause
  // a re-fetch on every token renewal, creating an infinite loop.
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        if (coords) {
          await fetchNearby({ latitude: coords[1], longitude: coords[0] });
        } else {
          await fetchNearby({});
        }
      })();

      return () => {
        mounted = false;
      };
    }, [coords, fetchNearby])
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
            <View style={styles.buyCreditsButtonContainer}>
              <LinearGradient
                colors={['#ff7f50', '#ff4500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buyCreditsButtonGradient}
              >
                <Button
                  mode="contained"
                  style={[styles.buyCreditsButton, { backgroundColor: 'transparent' }]} // Transparent to show gradient
                  contentStyle={styles.buyCreditsButtonContent}
                  labelStyle={styles.buyCreditsButtonLabel}
                  icon={() => <MaterialIcons name="shopping-cart" size={20} color="white" />} // Add cart icon
                  onPress={() => (navigation as any).navigate('CreditsPackage')}
                >
                  Comprar pacotes de créditos
                </Button>
              </LinearGradient>
            </View>
            <View style={{ marginTop: 10 }}>
              <Button mode="outlined" onPress={() => (navigation as any).navigate('ContactedProjects')}>Projetos que contatei</Button>
              <Button mode="outlined" icon="message-text" onPress={() => (navigation as any).navigate('ChatList')}>Minhas Conversas</Button>
              <Button
                mode="outlined"
                icon="star"
                onPress={() => (navigation as any).navigate('EditProfessionalSettings')}
              >
                Minhas Especialidades
              </Button>
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
  buyCreditsButtonContainer: {
    marginTop: 16,
  },
  buyCreditsButton: {
    width: '100%',
  },
  buyCreditsButtonContent: {
    paddingVertical: 12,
  },
  buyCreditsButtonLabel: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  buyCreditsButtonGradient: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionContainer: {
    marginTop: 20,
  },
});