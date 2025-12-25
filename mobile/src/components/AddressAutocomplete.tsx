import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { TextInput, List, useTheme, Chip } from 'react-native-paper';
import * as Location from 'expo-location';
import { geocodeAddress } from '../services/location';

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
  address?: any;
  raw?: any;
  provider?: string;
  city?: string;
  region?: string;
  postalCode?: string;
};

type Props = {
  value?: string;
  onChangeText?: (text: string) => void;
  onSelect: (item: { address: string; coordinates: [number, number]; provider?: string; raw?: any; city?: string; region?: string; postalCode?: string }) => void;
  placeholder?: string;
};

export default function AddressAutocomplete({ value, onChangeText, onSelect, placeholder }: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState(value ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const timerRef = useRef<any>(null);
  const queryIdRef = useRef(0);

  useEffect(() => setQuery(value ?? ''), [value]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 350);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  async function fetchSuggestions(q: string) {
    const myId = ++queryIdRef.current;
    try {
      setError(undefined);
      // If the query looks like a CEP (8 digits or 5-3 format), try ViaCEP first
      const cepOnly = q.replace(/\D+/g, '');
      if (/^\d{8}$/.test(cepOnly)) {
        try {
          const resp = await fetch(`https://viacep.com.br/ws/${cepOnly}/json/`);
          const data = await resp.json();
          if (!data.erro) {
            const endereco = `${data.logradouro || ''}${data.bairro ? ' - ' + data.bairro : ''}`.trim();
            const display = `${endereco} ${data.localidade || ''} ${data.uf || ''}`.trim();
            const results = await geocodeAddress(display);
            const s: Suggestion[] = results.slice(0, 3).map((r) => ({ display_name: display, lat: r.latitude.toString(), lon: r.longitude.toString(), raw: r, provider: 'viacep', city: data.localidade, region: data.uf, postalCode: cepOnly }));
            if (queryIdRef.current === myId) setSuggestions(s);
            return;
          }
        } catch (err) {
          // swallow and fallback to geocode
        }
      }

      const results = await geocodeAddress(q);
      // perform reverse geocoding in parallel and respect the latest query id
      const sliced = results.slice(0, 6);
      const revPromises = sliced.map((result) =>
        Location.reverseGeocodeAsync({ latitude: result.latitude, longitude: result.longitude }).then((rev) => ({ result, rev }))
      );
      const resolved = await Promise.all(revPromises);
      const suggestions: Suggestion[] = resolved.map(({ result, rev }) => {
        const formattedAddress = rev && rev.length > 0 ? rev[0].formattedAddress || `${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}` : `${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`;
        return { display_name: formattedAddress, lat: result.latitude.toString(), lon: result.longitude.toString(), raw: result, provider: 'expo_location', city: rev && rev[0] ? (rev[0].city || rev[0].subregion || undefined) : undefined, region: rev && rev[0] ? (rev[0].region || undefined) : undefined, postalCode: rev && rev[0] ? (rev[0].postalCode || undefined) : undefined };
      });
      if (queryIdRef.current === myId) setSuggestions(suggestions);
    } catch (err) {
      console.warn('Geocoding failed', err);
      setSuggestions([]);
      setError('Erro ao geocodificar endereço. Tente novamente.');
    }
  }

  function handleSelect(item: Suggestion) {
    setQuery(item.display_name);
    setSuggestions([]);
    const coords: [number, number] = [parseFloat(item.lon), parseFloat(item.lat)];
    onSelect({ address: item.display_name, coordinates: coords, provider: item.provider, raw: item.raw, city: item.city, region: item.region, postalCode: item.postalCode });
  }

  return (
    <View>
      <TextInput
        label={placeholder || 'Endereço'}
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          onChangeText && onChangeText(t);
        }}
        mode="outlined"
        style={styles.input}
        selectionColor={"#5f43ee"}
        outlineColor={'#ddd'}
        activeOutlineColor={"#5f43ee"}
      />
      {error ? (
        <List.Subheader style={styles.error}>{error}</List.Subheader>
      ) : null}
      {suggestions.length > 0 && (
        <View style={styles.list}>
            {suggestions.map((item) => (
              <TouchableOpacity key={`${item.lat}-${item.lon}`} onPress={() => handleSelect(item)} style={styles.suggestionItem}>
                <View style={styles.suggestionText}>
                  <List.Item titleNumberOfLines={2} title={item.display_name} description={`${parseFloat(item.lat).toFixed(6)}, ${parseFloat(item.lon).toFixed(6)}`} />
                </View>
                {item.provider ? (
                  <Chip style={styles.providerChip} mode="outlined">{item.provider}</Chip>
                ) : null}
              </TouchableOpacity>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 8 },
  list: { backgroundColor: '#fff', maxHeight: 260, borderRadius: 4, overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f4f4f4' },
  suggestionText: { flex: 1 },
  providerChip: { marginLeft: 8, backgroundColor: '#fff', borderColor: '#eee', borderRadius: 4, height: 28 },
  error: { color: '#b00020', paddingHorizontal: 8 },
});
