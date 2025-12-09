import React, { useEffect, useState } from 'react';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { View, Text, Image, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import useAuthStore from "../stores/authStore";


interface LocationAvatarProps {
    showLocation?: boolean;
}

export default function LocationAvatar({ showLocation = true }: LocationAvatarProps) {
    const user = useAuthStore((state) => state.user);
    const [locationText, setLocationText] = useState<string>('Obtendo localização...');
    const initials = user?.full_name ? user.full_name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() : 'U';
    const [neigbhorhood, setNeigbhorhood] = useState<string>('');
    const { localUri } = useProfilePhoto(user?.id || null, user?.photo || null);
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
        // Só busca no cache se não tiver localUri ou photo_local
        if (!localUri && !user?.photo_local) {
            findCachedPhoto();
        }
    }, [localUri, user?.photo_local]);

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
            } else {
                setLocationText('Localização desconhecida');
            }
        } catch (error) {
            console.error('Erro ao obter localização:', error);
            setLocationText('Erro ao obter localização');
        }
    };

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
                        </View>
                    </View>
                </View>
            )}
                {(localUri || cachedPhotoUri || user?.photo_local || user?.photo) ? (
                    <Image source={{ uri: localUri || cachedPhotoUri || user?.photo_local || user?.photo }} style={styles.avatar} />
            ) : (
                <View style={styles.fallback}>
                    <Text style={styles.fallbackText}>{initials}</Text>
                </View>
            )}
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
});