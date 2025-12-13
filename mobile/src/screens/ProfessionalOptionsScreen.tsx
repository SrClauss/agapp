import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Text, Card, Chip, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cats, settings] = await Promise.all([
        getCategories(),
        getProfessionalSettings(token!),
      ]);
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
    } catch (err) {
      console.warn('Erro ao carregar opções do profissional', err);
    } finally {
      setLoading(false);
    }
  };

  const openCategory = (cat: any) => {
    navigation.navigate('ProfessionalSubcategorySelect' as any, {
      category: cat,
      selected: selectedByCategory[cat.name] || [],
      onSelect: (selected: string[]) => {
        setSelectedByCategory((prev) => ({ ...prev, [cat.name]: selected }));
      },
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const flattened = Object.values(selectedByCategory).flat();
      await updateProfessionalSettings(token!, {
        subcategories: flattened,
        service_radius_km: parseFloat(radius) || 10,
      });
      // Update authStore user if backend returns updated user - not mandatory
    } catch (err) {
      console.warn('Erro ao salvar opções do profissional', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.title}>Opções do Profissional</Text>
        <Text style={styles.subtitle}>Configure seu raio de atuação e subcategorias</Text>
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

        {categories.map((cat) => (
          <Card key={cat.id} style={styles.card}>
            <TouchableOpacity onPress={() => openCategory(cat)} style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{cat.name}</Text>
            </TouchableOpacity>
            <Card.Content>
              <View style={styles.chipsContainer}>
                {(selectedByCategory[cat.name] || []).map((s) => (
                  <Chip key={s} style={styles.chip}>{s}</Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        ))}

        <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={styles.saveButton}>
          Salvar
        </Button>
      </ScrollView>
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
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { marginRight: 8, marginBottom: 8 },
  saveButton: { marginTop: 12 }
});
