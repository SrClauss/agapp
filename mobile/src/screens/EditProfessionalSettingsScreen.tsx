import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Checkbox, ActivityIndicator, Snackbar, List } from 'react-native-paper';
import { getSubcategoriesWithParent } from '../api/categories';
import { getProfessionalSettings, updateProfessionalSettings } from '../api/users';
import useAuthStore from '../stores/authStore';
import useSettingsStore from '../stores/settingsStore';

export default function EditProfessionalSettingsScreen({ navigation }: any) {
  const token = useAuthStore((s) => s.token);
  const [available, setAvailable] = useState<Array<{ parent: { id: string; name: string }; name: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const subs = await getSubcategoriesWithParent();
      setAvailable(subs);
      // fetch current user's professional settings
      if (token) {
        const settings = await getProfessionalSettings(token);
        setSelected(settings?.subcategories || []);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar subcategorias/settings', err);
      setMsg('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((p) => p !== name);
      return [...prev, name];
    });
  };

  const handleSave = async () => {
    if (!token) return setMsg('Usuário não autenticado');
    setSaving(true);
    try {
      await updateProfessionalSettings(token, { subcategories: selected });
      // update local settings store (if present)
      try { await useSettingsStore.getState().loadFromServer(token); } catch (e) { /* ignore */ }
      setMsg('Subcategorias salvas com sucesso');
      navigation.goBack();
    } catch (err: any) {
      console.warn('Erro ao salvar subcategories', err);
      setMsg(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const grouped: Record<string, string[]> = {};
  available.forEach((s) => {
    const parent = s.parent?.name || 'Outras';
    grouped[parent] = grouped[parent] || [];
    grouped[parent].push(s.name);
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text variant="headlineSmall">Categorias de atuação</Text>
        <Text variant="bodyMedium" style={{ marginTop: 6, color: '#666' }}>
          Selecione as subcategorias em que você atua; somente projetos nessas subcategorias
          serão mostrados quando você usar a busca por proximidade.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator animating size="large" style={{ marginTop: 30 }} />
      ) : (
        Object.keys(grouped).map((parent) => (
          <View key={parent} style={styles.group}>
            <Text variant="titleMedium" style={{ marginBottom: 8 }}>{parent}</Text>
            {grouped[parent].map((sub) => (
              <List.Item
                key={sub}
                title={sub}
                onPress={() => toggle(sub)}
                left={() => (
                  <Checkbox
                    status={selected.includes(sub) ? 'checked' : 'unchecked'}
                    onPress={() => toggle(sub)}
                  />
                )}
              />
            ))}
          </View>
        ))
      )}

      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => navigation.goBack()} disabled={saving}>Cancelar</Button>
        <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving}>
          Salvar
        </Button>
      </View>

      <Snackbar visible={!!msg} onDismiss={() => setMsg(null)}>{msg}</Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  headerRow: { marginBottom: 16 },
  group: { marginBottom: 16, backgroundColor: '#fff', borderRadius: 8, padding: 8 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 20 },
});
