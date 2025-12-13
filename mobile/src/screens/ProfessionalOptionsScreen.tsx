import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Text, Card, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { getCategories } from '../api/categories';
import { getProfessionalSettings, updateProfessionalSettings } from '../api/users';
import { useAuthStore } from '../stores/authStore';

export default function ProfessionalOptionsScreen() {
  const navigation = useNavigation();
  const { token, user } = useAuthStore();
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedByCategory, setSelectedByCategory] = useState<Record<string, string[]>>({});
  const [radius, setRadius] = useState<string>('10');
  const [establishmentAddress, setEstablishmentAddress] = useState<string>('');
  const [establishmentCoords, setEstablishmentCoords] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused]);

  const loadData = async () => {
    try {
      setLoading(true);
      const cats = await getCategories();
      let settings: any = {};
      if (token) {
        try {
          settings = await getProfessionalSettings(token);
        } catch (err) {
          console.warn('Não foi possível obter professional settings:', err);
          // If unauthorized, don't logout here — axios interceptor handles it. Just continue with defaults.
          settings = {};
        }
      }
      setCategories(cats);

      // Build selectedByCategory map: categoryName => [sub categories]
      const map: Record<string, string[]> = {};
      const subs = settings.subcategories || [];
      subs.forEach((s: string) => {
        // Find parent category name
        for (const cat of cats) {
          const found = (cat.subcategories || []).find((sub: any) => sub.name === s);
          if (found) {
            if (!map[cat.name]) map[cat.name] = [];
            map[cat.name].push(s);
            break;
          }
        }
      });

      setSelectedByCategory(map);
      setRadius((settings.service_radius_km || 10).toString());
      setEstablishmentAddress(settings.establishment_address || '');
      if (settings.establishment_coordinates && settings.establishment_coordinates.length === 2) {
        setEstablishmentCoords([settings.establishment_coordinates[0], settings.establishment_coordinates[1]]);
      }
    } catch (err) {
      console.warn('Erro ao carregar opções do profissional', err);
    } finally {
      setLoading(false);
    }
  };

  const openCategory = (cat: any) => {
    navigation.navigate('ProfessionalSubcategorySelect' as any, {
      category: cat,
      selected: selectedByCategory[cat.name] || []
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const flattened = Object.values(selectedByCategory).flat();
      if (!token) {
        Alert.alert('Autenticação', 'Você precisa estar autenticado para salvar.');
        return;
      }
      const payload: any = {
        subcategories: flattened,
        service_radius_km: parseFloat(radius) || 10,
      };
      if (establishmentAddress) payload.establishment_address = establishmentAddress;
      if (establishmentCoords) payload.establishment_coordinates = establishmentCoords;

      await updateProfessionalSettings(token!, payload);
      // After saving, go back to previous screen
      (navigation as any).goBack();
    } catch (err) {
      console.warn('Erro ao salvar opções do profissional', err);
    } finally {
      setSaving(false);
    }
  };

  const useMyLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão Negada', 'Precisamos de permissão para acessar sua localização.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      setEstablishmentCoords([longitude, latitude]);
      // Optionally reverse geocode to get a readable address
      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (address) {
          const parts = [address.street, address.streetNumber, address.district, address.city, address.region].filter(Boolean);
          setEstablishmentAddress(parts.join(', '));
        }
      } catch (e) {
        // ignore reverse geocode errors
      }
      Alert.alert('Localização', 'Localização atual capturada. Salve para aplicar.');
    } catch (e) {
      console.warn('Erro ao obter localização', e);
      Alert.alert('Erro', 'Não foi possível obter sua localização');
    } finally {
      setLocating(false);
    }
  };

  // handleSave now saves settings and goes back

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 240 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Opções do Profissional</Text>
        <Text style={styles.subtitle}>Configure seu raio de atuação e suas áreas de atuação</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Raio de detecção (km)</Text>
          <TextInput
            style={styles.radiusInput}
            value={radius}
            keyboardType="numeric"
            onChangeText={setRadius}
            placeholder="10"
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Endereço do Estabelecimento</Text>
          <TextInput
            style={[styles.radiusInput, { flex: 1 }]}
            value={establishmentAddress}
            onChangeText={setEstablishmentAddress}
            placeholder="Rua, número, bairro, cidade"
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Button mode="outlined" onPress={useMyLocation} loading={locating} disabled={locating}>
            Usar localização atual
          </Button>
          <View style={{ width: 12 }} />
          <Text style={{ color: colors.textSecondary }}>{establishmentCoords ? `Lat:${establishmentCoords[1].toFixed(6)} Lon:${establishmentCoords[0].toFixed(6)}` : 'Coordenadas não definidas'}</Text>
        </View>
        <View style={styles.cardsGrid}>
          {categories.map((cat, idx) => {
            const count = (selectedByCategory[cat.name] || []).length;
            const key = cat.id || cat._id || `${cat.name}_${idx}`;
            return (
              <TouchableOpacity key={key} onPress={() => openCategory(cat)} style={styles.cardWrapper}>
                <Card style={styles.card}>
                  <Card.Content style={styles.cardContent}>
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle}>{cat.name}</Text>
                      <Text style={styles.cardSubtitle}>{count} selecionada(s)</Text>
                    </View>
                    <View style={styles.cardActions}>
                      <IconButton icon="chevron-right" size={20} onPress={() => openCategory(cat)} />
                    </View>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>
      {/* Footer with action buttons - pinned to safe area */}
      <SafeAreaView edges={["bottom"]} style={styles.footer} pointerEvents="box-none">
        <View style={styles.footerInner} pointerEvents="box-none">
          <Button mode="outlined" onPress={() => (navigation as any).goBack()} style={styles.cancelButton}>
            Cancelar
          </Button>
          <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={styles.saveButton}>
            Salvar
          </Button>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: colors.background},
  container: { paddingHorizontal: 16, paddingTop: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: colors.textSecondary, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  label: { flex: 1 },
  radiusInput: { width: 100, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  card: { marginBottom: 12 },
  cardHeader: { padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardsGrid: { flexDirection: 'column', gap: 8 },
  cardWrapper: { width: '100%', marginBottom: 12 },
  card: { minHeight: 110, justifyContent: 'center', borderRadius: 8 },
  cardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardText: { flex: 1, paddingRight: 8 },
  cardSubtitle: { color: colors.textSecondary, marginTop: 6 },
  cardActions: { alignItems: 'center', flexDirection: 'row' },
  saveButton: { marginTop: 12, flex: 1, marginLeft: 8 },
  buttonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  cancelButton: { marginRight: 8, flex: 1 },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  footerInner: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between' }
});
