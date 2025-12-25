import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Portal, Modal, TextInput, Button } from 'react-native-paper';
import { LocationGeocodedAddress } from 'expo-location';

type Props = {
  visible: boolean;
  initial?: { address?: string; coordinates?: { latitude: number; longitude: number }; provider?: string; city?: string; region?: string; postalCode?: string; number?: string; complement?: string; district?: string; reference?: string };
  onDismiss: () => void;
  onOpenMap: (coords: { latitude: number; longitude: number }) => void;
  onSave: (payload: { formatted?: string; city?: string; region?: string; postalCode?: string; coordinates?: { latitude: number; longitude: number }; provider?: string; number?: string; complement?: string; district?: string; reference?: string }) => void;
};

export default function EditAddressModal({ visible, initial, onDismiss, onOpenMap, onSave }: Props) {
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [district, setDistrict] = useState('');
  const [reference, setReference] = useState('');
  
  useEffect(() => {
    if (visible && initial) {
      setStreet(initial.address || '');
      setCity(initial.city || '');
      setRegion(initial.region || '');
      setPostalCode(initial.postalCode || '');
      setNumber(initial.number || '');
      setComplement(initial.complement || '');
      setDistrict(initial.district || '');
      setReference(initial.reference || '');
    }
  }, [visible, initial]);

  function handleSave() {
    onSave({ formatted: street.trim() || undefined, city: city.trim() || undefined, region: region.trim() || undefined, postalCode: postalCode.trim() || undefined, coordinates: initial?.coordinates, provider: initial?.provider, ...((number && { number: number.trim() }) || {}), ...((complement && { complement: complement.trim() }) || {}), ...((reference && { reference: reference.trim() }) || {}), ...((district && { district: district.trim() }) || {}) } as any);
  }

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <View style={styles.modalHeader}>
          <Text style={styles.title}>Editar Endereço</Text>
          <Text style={styles.hint}>Revise a sugestão e ajuste campos antes de confirmar no mapa.</Text>
        </View>
        <View style={styles.modalBody}>
          <TextInput label="Endereço" value={street} onChangeText={setStreet} mode="outlined" style={styles.input} />
          <TextInput label="Bairro" value={district} onChangeText={setDistrict} mode="outlined" style={styles.input} />
          <View style={{ flexDirection: 'row' }}>
            <TextInput label="Cidade" value={city} onChangeText={setCity} mode="outlined" style={[styles.input, { flex: 1, marginRight: 8 }]} />
            <TextInput label="Estado (UF)" value={region} onChangeText={setRegion} mode="outlined" style={[styles.input, { width: 80 }]} maxLength={2} />
          </View>
          <TextInput label="CEP" value={postalCode} onChangeText={setPostalCode} mode="outlined" style={styles.input} keyboardType="numeric" />
          <View style={{ flexDirection: 'row' }}>
            <TextInput label="Número (opcional)" value={number} onChangeText={setNumber} mode="outlined" style={[styles.input, { flex: 1, marginRight: 8 }]} keyboardType="default" />
            <TextInput label="Complemento (opcional)" value={complement} onChangeText={setComplement} mode="outlined" style={[styles.input, { flex: 1 }]} />
          </View>
          <TextInput label="Ponto de referência (opcional)" value={reference} onChangeText={setReference} mode="outlined" style={styles.input} />

          {initial?.coordinates ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: '#666', marginBottom: 6 }}>Coordenadas sugeridas: {initial.coordinates.latitude.toFixed(6)}, {initial.coordinates.longitude.toFixed(6)}</Text>
              <Button compact mode="outlined" onPress={() => onOpenMap(initial.coordinates!)}>Abrir mapa</Button>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button compact onPress={onDismiss}>Cancelar</Button>
          <Button compact mode="contained" onPress={handleSave} style={{ marginLeft: 8 }}>Salvar</Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', margin: 20, borderRadius: 8, padding: 12 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  hint: { fontSize: 12, color: '#666', marginBottom: 10 },
  input: { marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  modalHeader: { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f4f4f4', marginBottom: 8 },
  modalBody: { paddingTop: 8 },
});
