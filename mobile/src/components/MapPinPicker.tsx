import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Platform, Linking } from 'react-native';
import { Portal, Modal, Button, TextInput } from 'react-native-paper';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

type Props = {
  visible: boolean;
  initialCoords?: { latitude: number; longitude: number };
  onDismiss: () => void;
  onConfirm: (coords: { latitude: number; longitude: number }) => void;
};

export default function MapPinPicker({ visible, initialCoords, onDismiss, onConfirm }: Props) {
  const [pos, setPos] = useState<{ latitude: number; longitude: number }>(
    initialCoords || { latitude: -23.55, longitude: -46.63 }
  );

  // Recenter when initialCoords changes or when the modal becomes visible
  useEffect(() => {
    if (initialCoords) {
      setPos(initialCoords);
    }
  }, [initialCoords]);

  // Detect presence of a Google Maps API key (Expo public env var) and platform
  const mapsApiKeyFromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  // If running on Android and the project has a local google-services.json, try to read the key from it
  let mapsApiKeyFromJson: string | undefined = undefined;
  if (Platform.OS === 'android') {
    try {
      // Bundler will include this file so require works in dev bundle
      // path relative to this file: ../../google-services.json
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const gs = require('../../google-services.json');
      if (gs && gs.client && gs.client[0] && gs.client[0].api_key && gs.client[0].api_key[0] && gs.client[0].api_key[0].current_key) {
        mapsApiKeyFromJson = gs.client[0].api_key[0].current_key;
      }
    } catch (err) {
      // file not present or not accessible in this environment
      mapsApiKeyFromJson = undefined;
    }
  }

  const mapsApiKey = mapsApiKeyFromEnv || mapsApiKeyFromJson;
  const canUseGoogleMaps = Platform.OS === 'ios' || Boolean(mapsApiKey);

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <View style={{ height: 360, borderRadius: 8, overflow: 'hidden' }}>
          {canUseGoogleMaps ? (
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={{ latitude: pos.latitude, longitude: pos.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
              onPress={(e) => setPos(e.nativeEvent.coordinate)}
            >
              <Marker draggable coordinate={pos} onDragEnd={(e) => setPos(e.nativeEvent.coordinate)} />
            </MapView>
          ) : (
            <View style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
              <Text style={{ marginBottom: 8 }}>Nenhuma chave do Google Maps configurada para esta plataforma.</Text>
              <Text style={{ marginBottom: 12, color: '#666' }}>
                Você pode inserir manualmente as coordenadas ou abrir o local no OpenStreetMap no navegador.
              </Text>
              <Text style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
                Dica: para usar o mapa nativo no Android configure a chave em `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` e nas configurações do projeto (Google Maps Android API).
              </Text>
              <TextInput
                label="Latitude"
                value={String(pos.latitude)}
                onChangeText={(t) => setPos((p) => ({ ...p, latitude: parseFloat(t) || 0 }))}
                mode="outlined"
                style={{ marginBottom: 8 }}
                keyboardType="numeric"
              />
              <TextInput
                label="Longitude"
                value={String(pos.longitude)}
                onChangeText={(t) => setPos((p) => ({ ...p, longitude: parseFloat(t) || 0 }))}
                mode="outlined"
                keyboardType="numeric"
              />
              <Button compact onPress={() => {
                const url = `https://www.openstreetmap.org/?mlat=${pos.latitude}&mlon=${pos.longitude}#map=18/${pos.latitude}/${pos.longitude}`;
                Linking.openURL(url).catch(() => {});
              }} style={{ marginTop: 12 }}>Abrir no OpenStreetMap</Button>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
          <Button compact icon="close" onPress={onDismiss} style={{ borderRadius: 4 }}>Cancelar</Button>
          <Button compact icon="check" mode="contained" onPress={() => onConfirm(pos)} style={{ marginLeft: 8, borderRadius: 4 }}>Confirmar</Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', margin: 20, borderRadius: 8, padding: 12 },
});
