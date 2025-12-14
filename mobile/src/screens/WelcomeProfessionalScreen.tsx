import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, FAB} from 'react-native-paper';
import { colors } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';
import LocationAvatar from '../components/LocationAvatar';
import NearbySummary from '../components/NearbySummary';
import { BannerAd } from '../components/BannerAd';
import { useLocationStore } from '../stores/locationStore';
import useProjectsNearbyStore from '../stores/projectsNearbyStore';
import useAuthStore from '../stores/authStore';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';


export default function WelcomeProfessionalScreen() {

  const coords = useLocationStore((s) => s.coords);
  const fetchNearby = useProjectsNearbyStore((s) => s.fetchProjectsNearby);
  const projectsNearby = useProjectsNearbyStore((s) => s.projectsNearby);
  const projectsAll = useProjectsNearbyStore((s) => s.projectsAll);
  const projectsNonRemote = useProjectsNearbyStore((s) => s.projectsNonRemote);
  const loading = useProjectsNearbyStore((s) => s.loading);
  const token = useAuthStore((s) => s.token);
  const navigation = useNavigation();
  
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>

        <LocationAvatar />
        <BannerAd adType="banner_professional" minHeight={90} maxHeight={200} />
        <NearbySummary />
         <FAB 
          style={styles.FAB}
          color='white'
          icon="logout"
          label="Sair"
          onPress={() => navigation.navigate('ProfileSelection' as never)}
        />
        
         
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, paddingBottom: 80 },
  container: { flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start', padding: 16 },
  text: { fontSize: 18, color: colors.text, textAlign: 'left' },
  FAB: {
    position: 'absolute',
    
    bottom: 16,
    right: 16,

    backgroundColor: colors.error,
  }
});
