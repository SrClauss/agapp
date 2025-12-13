import React, { useEffect, useState } from 'react';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { View, Text, Image, StyleSheet } from 'react-native';
import { IconButton, Badge } from 'react-native-paper';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import useAuthStore from "../stores/authStore";
import useNotificationStore from '../stores/notificationStore';


interface LocationAvatarProps {
    showLocation?: boolean;
}

export default function LocationAvatar({ showLocation = true }: LocationAvatarProps) {
    const user = useAuthStore((state) => state.user);
    const [locationText, setLocationText] = useState<string>('Obtendo localização...');
    const initials = user?.full_name ? user.full_name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() : 'U';
    const [neigbhorhood, setNeigbhorhood] = useState<string>('');
    const [coords, setCoords] = useState<[number, number] | null>(null);
    const { localUri } = useProfilePhoto(user?.id || null, user?.avatar_url || null);
    const navigation = useNavigation();
    const notificationCount = useNotificationStore((s) => s.count);
    const [cachedPhotoUri, setCachedPhotoUri] = useState<string | null>(null);

    // Busca genérica de foto no cache quando não há contexto completo
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
                // Pega o primeiro arquivo de foto encontrado
                const photoFile = files.find(f => f.startsWith('profile_') && (f.endsWith('.jpg') || f.endsWith('.png')));
                if (photoFile) {
                    setCachedPhotoUri(`${folder}${photoFile}`);
                } else {
                    setCachedPhotoUri(null);
                }
            } catch (err) {
                console.error('Erro ao buscar foto em cache:', err);
                setCachedPhotoUri(null);
            }
        }
        // Só busca no cache se não tiver localUri ou avatar_local
        if (!localUri && !user?.avatar_local) {
            findCachedPhoto();
        }
    }, [localUri, user?.avatar_local]);

    useEffect(() => {
        if (showLocation) {
            getCurrentLocation();
        }
    }, [showLocation]);

    // localUri provided by useProfilePhoto hook contains a cached local path if available.

    const getCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationText('Localização não permitida');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            // Reverse geocoding to get city and state
            const [address] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            if (address) {
                const neigbhorhood = address.district || '';
                const city = address.city || address.subregion || '';
                const state = address.region || '';
                setLocationText(`${city}, ${state}`);
                setNeigbhorhood(neigbhorhood);
                // store coordinates in [longitude, latitude] order to match backend
                setCoords([location.coords.longitude, location.coords.latitude]);
            } else {
                setLocationText('Localização desconhecida');
            }
        } catch (error) {
            console.error('Erro ao obter localização:', error);
            setLocationText('Erro ao obter localização');
        }
    };


    const openNotifications = () => {
        // Navigate to a Notifications screen if exists; otherwise fallback to Profile
        try {
            navigation.navigate('Notifications' as never);
        } catch (err) {
            // if screen not found just log
            console.warn('Notifications screen not configured', err);
        }
    };

    // API for external code: button/other code can call setNotificationCount or inc/dec via useNotificationStore

    return (
        <View style={styles.container}>
            {showLocation && (
                <View style={styles.locationContainer}>
                    <Text style={styles.locationLabel}>Localização</Text>
                    <View style={styles.locationRow}>
                        <View style={styles.pinContainer}>
                            <Text style={styles.locationIcon}>📍</Text>
                        </View>
                        <View style={styles.locationTextContainer}>
                            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">{locationText}</Text>
                            {neigbhorhood ? (
                                <Text style={styles.neigbhorhoodText}>{neigbhorhood}</Text>
                            ) : null}
                            {coords ? (
                                <Text style={styles.coordsText}>{`Lat: ${coords[1].toFixed(6)} • Lon: ${coords[0].toFixed(6)}`}</Text>
                            ) : null}
                        </View>
                    </View>
                </View>
            )}
                {/* Notification icon with badge (moved to left of avatar) */}
                <View style={styles.notificationsContainerLeft}>
                    <IconButton
                        onPress={openNotifications}
                        icon={({ size, color }) => (
                            <MaterialIcons 
                            name={notificationCount > 0 ? 'notifications' : 'notifications-none'}
                            size={size} color={color} />
                        )}
                        size={22}
                        iconColor={notificationCount > 0 ? 'red' : '#333'}
                        style={styles.notificationIcon}
                    />
                    {notificationCount > 0 && (
                        <Badge style={styles.notificationBadgeLeft}>{notificationCount}</Badge>
                    )}
                </View>

                <View style={styles.avatarWrapper}>
                    {(localUri || cachedPhotoUri || user?.avatar_local || user?.avatar_url) ? (
                        <Image source={{ uri: localUri || cachedPhotoUri || user?.avatar_local || user?.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={styles.fallback}>
                            <Text style={styles.fallbackText}>{initials}</Text>
                        </View>
                    )}

                </View>

                
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: 25,
    },
    locationContainer: {
        flex: 1,
        marginRight: 12,
    },
    locationLabel: {
        fontSize: 11,
        color: '#999',
        marginBottom: 4,
        fontWeight: '500',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pinContainer: {
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
   },
    locationTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    locationIcon: {
        fontSize: 14,
        marginRight: 4,
    },
    locationText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '600',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#FFF',
    },
    fallback: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#DDD',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    neigbhorhoodText: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    fallbackText: {
        color: '#666',
        fontWeight: '700',
        fontSize: 16,
    },
    avatarWrapper: {
        position: 'relative',
        marginLeft: 10,
        marginRight: 6,
    },
        // logout overlay removed per design
    /* notificationsContainer removed in favor of notificationsContainerLeft */
    notificationIcon: {
        margin: 0,
        padding: 0,
    },
    /* notificationBadge removed - using notificationBadgeLeft */
    notificationsContainerLeft: {
        marginRight: 8,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationBadgeLeft: {
        position: 'absolute',
        top: -2,
        right: -6,
        backgroundColor: '#E53935',
        color: '#fff',
    },
});