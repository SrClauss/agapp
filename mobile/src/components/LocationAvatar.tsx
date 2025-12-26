import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconButton, Badge, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import useLocationStore from '../stores/locationStore';
import useAuthStore from '../stores/authStore';
import useNotificationStore from '../stores/notificationStore';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';

interface Props {
  backgroundUri?: string | ImageSourcePropType;
}

export default function LocationAvatar({ backgroundUri }: Props) {
  const locationText = useLocationStore((s) => s.locationText);
  const neighborhood = useLocationStore((s) => s.neighborhood);
  const locationLoading = useLocationStore((s) => s.loading);
  const fetchLocation = useLocationStore((s) => s.fetchLocation);

  const user = useAuthStore((state) => state.user);
  const notificationCount = useNotificationStore((s) => s.count);
  const { localUri } = useProfilePhoto(user?.id || null, user?.avatar_url || null);
  const navigation = useNavigation();

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

  useEffect(() => {
    if (!locationText && !locationLoading) {
      fetchLocation().catch(() => {});
    }
  }, [locationText, locationLoading, fetchLocation]);

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

  // Try to load default background
  let bgSource: ImageSourcePropType | undefined;
  if (backgroundUri) {
    if (typeof backgroundUri === 'string') {
      bgSource = { uri: backgroundUri };
    } else {
      bgSource = backgroundUri;
    }
  } else {
    try {
      bgSource = require('../../assets/background.jpg');
    } catch (err) {
      bgSource = undefined;
    }
  }

  const content = (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => { if (!locationLoading) fetchLocation().catch(() => {}); }} style={styles.locationSection}>
        <Text style={styles.locationLabel}>Localização</Text>
        <View style={styles.locationRow}>
          <MaterialCommunityIcons name="map-marker" size={14} color="#fff" />
          {locationLoading ? (
            <ActivityIndicator animating={true} color="#fff" size="small" style={{ marginLeft: 6 }} />
          ) : (
            <View style={{ marginLeft: 6 }}>
              <Text style={styles.locationText}>{locationText || '—'}</Text>
              {neighborhood ? <Text style={styles.neighborhoodText}>{neighborhood}</Text> : null}
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.rightSection}>
        <View style={styles.notificationWrapper}>
          <IconButton
            icon={() => <MaterialCommunityIcons name={notificationCount > 0 ? 'bell' : 'bell-outline'} size={20} color="#fff" />}
            size={20}
            onPress={openNotifications}
            style={{ margin: 0 }}
          />
          {notificationCount > 0 && <Badge style={styles.badge}>{notificationCount}</Badge>}
        </View>

        <TouchableOpacity onPress={openProfile} style={styles.avatarWrapper}>
          {(() => {
            const src = localUri || cachedPhotoUri || user?.avatar_local || user?.avatar_url;
            if (!src) {
              return (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              );
            }
            return <Image source={{ uri: src }} style={styles.avatar} />;
          })()}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (bgSource) {
    return (
      <ImageBackground source={bgSource} style={styles.header} imageStyle={{ borderRadius: 12 }} resizeMode="cover">
        {content}
      </ImageBackground>
    );
  }

  return (
    <LinearGradient colors={['#6a00f4', '#00d1b2']} start={[0, 0]} end={[1, 1]} style={styles.header}>
      {content}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationSection: {
    flex: 1,
  },
  locationLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  neighborhoodText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ff3b30',
  },
  avatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 25,
    overflow: 'hidden',
  },
  avatar: {
    width: 40,
    height: 40,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});