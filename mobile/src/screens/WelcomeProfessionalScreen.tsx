import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, FAB} from 'react-native-paper';
import { colors } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';
import LocationAvatar from '../components/LocationAvatar';
import { BannerAd } from '../components/BannerAd';

export default function WelcomeProfessionalScreen() {


  const navigation = useNavigation();
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>

        <LocationAvatar />
        <BannerAd adType="banner_professional" minHeight={90} maxHeight={200} />

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
