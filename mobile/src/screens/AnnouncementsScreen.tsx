import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing } from '../theme';
import AppHeader from '../components/AppHeader';
import AnnouncementBanner, { Announcement } from '../components/AnnouncementBanner';
import EmptyState from '../components/EmptyState';
import { useSnackbar } from '../hooks/useSnackbar';
import apiService from '../services/api';

interface AnnouncementsScreenProps {
  navigation: StackNavigationProp<any>;
}

const AnnouncementsScreen: React.FC<AnnouncementsScreenProps> = ({ navigation }) => {
  const { showSnackbar } = useSnackbar();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  useFocusEffect(
    useCallback(() => {
      loadAnnouncements();
    }, [])
  );

  const loadAnnouncements = async () => {
    try {
      const token = await apiService.getToken();
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const data = await apiService.getAnnouncements(token);
      setAnnouncements(data);
    } catch (error: any) {
      console.error('Erro ao carregar anúncios:', error);
      showSnackbar('Não foi possível carregar os anúncios', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAnnouncementPress = async (announcement: Announcement) => {
    // Registra click
    try {
      const token = await apiService.getToken();
      if (token) {
        await apiService.registerAnnouncementInteraction(token, announcement.id, 'click');
      }
    } catch (error) {
      console.error('Erro ao registrar click:', error);
    }

    // Handle CTA link
    if (announcement.cta_link) {
      if (announcement.cta_link.startsWith('screen:')) {
        const screenName = announcement.cta_link.replace('screen:', '');
        navigation.navigate(screenName);
      } else if (announcement.cta_link.startsWith('url:')) {
        const url = announcement.cta_link.replace('url:', '');
        // Open URL in browser or WebView
        showSnackbar('Abrindo link...', 'info');
      }
    }
  };

  const handleAnnouncementView = async (id: string) => {
    try {
      const token = await apiService.getToken();
      if (token) {
        await apiService.registerAnnouncementInteraction(token, id, 'view');
      }
    } catch (error) {
      console.error('Erro ao registrar view:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnnouncements();
  };

  const filteredAnnouncements = announcements.filter((announcement) => {
    if (filterType === 'all') return true;
    return announcement.type === filterType;
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Novidades" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Novidades" showBack />

      <View style={styles.filtersContainer}>
        <SegmentedButtons
          value={filterType}
          onValueChange={setFilterType}
          buttons={[
            { value: 'all', label: 'Todos' },
            { value: 'feature', label: 'Recursos' },
            { value: 'banner', label: 'Promoções' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {filteredAnnouncements.length === 0 ? (
            <EmptyState
              icon="📢"
              title="Nenhum anúncio"
              message="Não há novidades no momento. Volte em breve!"
            />
          ) : (
            filteredAnnouncements.map((announcement) => (
              <AnnouncementBanner
                key={announcement.id}
                announcement={announcement}
                onPress={() => handleAnnouncementPress(announcement)}
                onView={handleAnnouncementView}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segmentedButtons: {
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
  },
});

export default AnnouncementsScreen;
