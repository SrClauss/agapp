import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Modal, Portal, TextInput, Button, List, Text, ActivityIndicator } from 'react-native-paper';
import searchServices from '../services/location';
import * as Location from 'expo-location';
import type { GeocodedAddress } from '../api/projects';

type Props = {
  visible: boolean;
  initialCity?: string;
  initialUF?: string;
  onDismiss: () => void;
  onSelect: (addr: GeocodedAddress & { latitude?: number; longitude?: number }) => void;
};

export default function AddressSearch({ visible, initialCity = '', initialUF = '', onDismiss, onSelect }: Props) {
  const [uf, setUf] = useState(initialUF);
  const [cidade, setCidade] = useState(initialCity);
  const [logradouro, setLogradouro] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  async function handleSearch() {
    if (!uf || !cidade || !logradouro) return;
    setLoading(true);
    try {
      const found = await searchServices.searchCEPByAddress(uf.trim(), cidade.trim(), logradouro.trim());
      setResults(found || []);
    } catch (err) {
      console.warn('Address search failed', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(item: any) {
    // Build an address string and geocode it
    const formatted = `${item.logradouro || ''}${item.bairro ? ', ' + item.bairro : ''}, ${item.localidade || cidade} - ${item.uf || uf}${item.cep ? ', CEP: ' + item.cep : ''}`.replace(/, ,/g, ',').replace(/^,|,$/g, '').trim();
    try {
      // Try to geocode the street+city+uf
      const query = `${item.logradouro} ${item.localidade} ${item.uf}`;
      const geocoded = await Location.geocodeAsync(query);
      if (geocoded && geocoded.length > 0) {
        const g = geocoded[0];
        const reverse = await Location.reverseGeocodeAsync({ latitude: g.latitude, longitude: g.longitude });
        const rev = reverse[0] || {};
        const addr: any = { ...rev, formatted, name: rev.name || formatted, display_name: formatted, latitude: g.latitude, longitude: g.longitude };
        onSelect(addr as any);
      } else {
        // fallback: just return a simple formatted custom address
        const addr: any = { formatted, city: item.localidade, region: item.uf };
        onSelect(addr as any);
      }
    } catch (err) {
      console.warn('Geocode after selection failed', err);
      const addr: any = { formatted, city: item.localidade, region: item.uf };
      onSelect(addr as any);
    } finally {
      onDismiss();
    }
  }

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <View>
          <Text style={styles.title}>Buscar Logradouro</Text>
          <TextInput label="UF" value={uf} onChangeText={setUf} mode="outlined" style={styles.input} placeholder="SP" />
          <TextInput label="Cidade" value={cidade} onChangeText={setCidade} mode="outlined" style={styles.input} placeholder="São Paulo" />
          <TextInput label="Logradouro" value={logradouro} onChangeText={setLogradouro} mode="outlined" style={styles.input} placeholder="Rua, avenida, etc." />

          <Button mode="contained" onPress={handleSearch} disabled={loading || !uf || !cidade || !logradouro} style={{ marginTop: 8 }}>
            Buscar
          </Button>

          {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}

          {!loading && results.length === 0 ? (
            <Text style={{ marginTop: 12, color: '#666' }}>Nenhum resultado ainda.</Text>
          ) : null}

          <FlatList
            data={results}
            keyExtractor={(it) => it.cep ?? String(it.logradouro) + String(it.localidade)}
            renderItem={({ item }) => (
              <List.Item
                title={`${item.logradouro || ''}${item.bairro ? ' — ' + item.bairro : ''}`}
                description={`${item.localidade || ''} - ${item.uf || ''}${item.cep ? ' • ' + item.cep : ''}`}
                onPress={() => handleSelect(item)}
                left={(props) => <List.Icon {...props} icon="map-marker" />}
              />
            )}
            style={{ marginTop: 8, maxHeight: 260 }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button onPress={onDismiss}>Fechar</Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', margin: 20, borderRadius: 8, padding: 12 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  input: { marginBottom: 8 },
});
