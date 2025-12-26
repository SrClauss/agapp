import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TextInput, IconButton, Badge, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import useLocationStore from '../stores/locationStore';
import { colors } from '../theme/colors';
import useAuthStore from '../stores/authStore';
import useNotificationStore from '../stores/notificationStore';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';

interface Props {
  value: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}

export default function RebrandHeader({ value, onChangeText, onSubmit, loading }: Props) {
  const locationText = useLocationStore((s) => s.locationText);
  const neighborhood = useLocationStore((s) => s.neighborhood);
  const locationLoading = useLocationStore((s) => s.loading);
  const fetchLocation = useLocationStore((s) => s.fetchLocation);

  const user = useAuthStore((s) => s.user);
  const notificationCount = useNotificationStore((s) => s.count);
  const { localUri } = useProfilePhoto(user?.id || null, user?.avatar_url || null);
  const navigation = useNavigation();

  useEffect(() => {
    // If we don't have a location yet, try fetching it
    if (!locationText && !locationLoading) {
      fetchLocation().catch(() => {});
    }
  }, [locationText, locationLoading, fetchLocation]);

  const [cachedPhotoUri, setCachedPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    async function findCachedPhoto() {
      try {
        const folder = `${FileSystem.cacheDirectory}profile/`;
        const dirInfo = await FileSystem.getInfoAsync(folder);
        if (!dirInfo.exists) {
          setCachedPhotoUri(null);
          return;
        }
        const files = await FileSystem.readDirectoryAsync(folder);
        const photoFile = files.find(f => f.startsWith('profile_') && (f.endsWith('.jpg') || f.endsWith('.png')));
        if (photoFile) setCachedPhotoUri(`${folder}${photoFile}`);
        else setCachedPhotoUri(null);
      } catch (err) {
        setCachedPhotoUri(null);
      }
    }
    if (!localUri && !user?.avatar_local) findCachedPhoto();
  }, [localUri, user?.avatar_local]);

  const openNotifications = () => {
    try {
      navigation.navigate('Notifications' as never);
    } catch (err) {
      navigation.navigate('Profile' as never);
    }
  };

  const openProfile = () => {
    if (!user) {
      try { navigation.navigate('Login' as never); } catch (err) { }
      return;
    }
    try { navigation.navigate('CompleteProfile' as never, { completeProfile: true } as any); } catch (err) { }
  };

  const initials = user?.full_name ? user.full_name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() : 'U';

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={[0, 0]}
      end={[1, 1]}
      style={styles.header}
    >
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => { if (!locationLoading) fetchLocation().catch(() => {}); }}>
          <Text style={styles.locationLabel}>Localização</Text>
          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker" size={14} color="rgba(255,255,255,0.95)" />
            {locationLoading ? (
              <ActivityIndicator animating={true} color="#fff" size="small" style={{ marginLeft: 6 }} />
            ) : (
              <View style={{ marginLeft: 6 }}>
                <Text style={styles.locationText}>{locationText || '—'}</Text>
                {neighborhood ? <Text style={styles.locationNeighborhood}>{neighborhood}</Text> : null}
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.headerIconsRight}>
          <View style={styles.notificationWrapper}>
            <IconButton onPress={openNotifications} icon={({ size, color }) => (
              <MaterialCommunityIcons name={notificationCount > 0 ? 'bell' : 'bell-outline'} size={20} color="#fff" />
            )} size={22} iconColor="#fff" style={{ margin: 0 }} />
            {notificationCount > 0 && (
              <Badge style={styles.notificationBadge}>{notificationCount}</Badge>
            )}
          </View>

          <TouchableOpacity style={styles.avatarWrapper} onPress={openProfile}>
            {(localUri || cachedPhotoUri || user?.avatar_local || user?.avatar_url) ? (
              <React.Fragment>
                <Image source={{ uri: localUri || cachedPhotoUri || user?.avatar_local || user?.avatar_url }} style={styles.avatar} />
              </React.Fragment>
            ) : (
              <View style={styles.fallback}>
                <Text style={styles.fallbackText}>{initials}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrapper}>
        <MaterialCommunityIcons name="magnify" size={20} color="rgba(255,255,255,0.8)" style={{ marginLeft: 12 }} />
        <TextInput
          placeholder="O que você está procurando?"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          mode="flat"
          style={styles.searchInput}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          placeholderTextColor="rgba(255,255,255,0.8)"
          right={loading ? <TextInput.Icon icon="loading" /> : undefined}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locationText: { color: '#fff', fontWeight: '700' },
  locationNeighborhood: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  headerIcons: { flexDirection: 'row' },
  headerIconsRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { marginLeft: 8, padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  notificationWrapper: { position: 'relative', marginRight: 8 },
  notificationBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#ff3b30', color: '#fff' },
  avatarWrapper: { borderRadius: 20, overflow: 'hidden' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  fallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontWeight: '800' },
  greeting: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12, marginBottom: 12 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, marginBottom: 8, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, color: '#fff', backgroundColor: 'transparent' },
});
