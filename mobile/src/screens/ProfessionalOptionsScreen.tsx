import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
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
      if (!token) {
        Alert.alert('Autenticação', 'Você precisa estar autenticado para salvar.');
        return;
      }
      await updateProfessionalSettings(token!, {
        subcategories: flattened,
        service_radius_km: parseFloat(radius) || 10,
      });
      // After saving, go back to previous screen
      (navigation as any).goBack();
    } catch (err) {
      console.warn('Erro ao salvar opções do profissional', err);
    } finally {
      setSaving(false);
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
        <View style={styles.cardsGrid}>
          {categories.map((cat) => {
            const count = (selectedByCategory[cat.name] || []).length;
            return (
              <TouchableOpacity key={cat.id} onPress={() => openCategory(cat)} style={styles.cardWrapper}>
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
