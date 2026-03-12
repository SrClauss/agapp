import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Portal, Dialog, Button, TextInput, Text } from 'react-native-paper';

type Props = {
  visible: boolean;
  initialCoords?: { latitude: number; longitude: number };
  onDismiss: () => void;
  onConfirm: (coords: { latitude: number; longitude: number }) => void;
};

export default function MapPinPicker({ visible, initialCoords, onDismiss, onConfirm }: Props) {
  const [pos, setPos] = useState(
    initialCoords || { latitude: -23.55, longitude: -46.63 }
  );

  useEffect(() => {
    if (initialCoords) {
      setPos(initialCoords);
    }
  }, [initialCoords]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Selecionar Localização</Dialog.Title>
        <Dialog.Content>
          <Text>Insira as coordenadas manualmente ou abra no mapa externo:</Text>
          <TextInput
            label="Latitude"
            value={String(pos.latitude)}
            onChangeText={(t) => setPos((p) => ({ ...p, latitude: parseFloat(t) || 0 }))}
            mode="outlined"
            style={{ marginTop: 8 }}
            keyboardType="numeric"
          />
          <TextInput
            label="Longitude"
            value={String(pos.longitude)}
            onChangeText={(t) => setPos((p) => ({ ...p, longitude: parseFloat(t) || 0 }))}
            mode="outlined"
            style={{ marginTop: 8 }}
            keyboardType="numeric"
          />
          <Button
            compact
            style={{ marginTop: 12 }}
            onPress={() => {
              const url = `https://www.openstreetmap.org/?mlat=${pos.latitude}&mlon=${pos.longitude}#map=18/${pos.latitude}/${pos.longitude}`;
              Linking.openURL(url).catch(() => {});
            }}
          >
            Abrir no OpenStreetMap
          </Button>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancelar</Button>
          <Button mode="contained" onPress={() => onConfirm(pos)}>
            Confirmar
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { padding: 0 },
  container: { backgroundColor: '#fff', margin: 20, borderRadius: 8, padding: 12 },
});
