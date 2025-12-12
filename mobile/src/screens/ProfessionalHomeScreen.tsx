import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Divider } from 'react-native-paper';

import LocationAvatar from '../components/LocationAvatar';
import { BannerAd } from '../components/BannerAd';
import { colors } from '../theme/colors';

export default function ProfessionalHomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.container}
      >
        <LocationAvatar />

        <BannerAd adType="banner_professional" minHeight={90} maxHeight={200} />

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
});
