import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Button,
  Chip,
  ActivityIndicator,
  Snackbar,
  Searchbar,
  Badge,
  Divider,
} from 'react-native-paper';
import { getSubcategoriesWithParent } from '../api/categories';
import { getProfessionalSettings, updateProfessionalSettings } from '../api/users';
import useAuthStore from '../stores/authStore';
import useSettingsStore from '../stores/settingsStore';
import { colors } from '../theme/colors';

export default function EditProfessionalSettingsScreen({ navigation }: any) {
  const token = useAuthStore((s) => s.token);
  const [available, setAvailable] = useState<Array<{ parent: { id: string; name: string }; name: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const subs = await getSubcategoriesWithParent();
      setAvailable(subs);
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
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const handleSave = async () => {
    if (!token) return setMsg('Usuário não autenticado');
    setSaving(true);
    try {
      await updateProfessionalSettings(token, { subcategories: selected });
      try { await useSettingsStore.getState().loadFromServer(token); } catch (e) { /* ignore */ }
      setMsg('Especialidades salvas com sucesso!');
      navigation.goBack();
    } catch (err: any) {
      console.warn('Erro ao salvar subcategories', err);
      setMsg(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // Group subcategories by parent category
  const grouped: Record<string, string[]> = useMemo(() => {
    const g: Record<string, string[]> = {};
    available.forEach((s) => {
      const parent = s.parent?.name || 'Outras';
      g[parent] = g[parent] || [];
      g[parent].push(s.name);
    });
    return g;
  }, [available]);

  // Filter groups by search query
  const filteredGrouped: Record<string, string[]> = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase();
    const result: Record<string, string[]> = {};
    Object.entries(grouped).forEach(([parent, subs]) => {
      const matchingParent = parent.toLowerCase().includes(q);
      const matchingSubs = subs.filter((s) => s.toLowerCase().includes(q));
      if (matchingParent) {
        result[parent] = subs; // show all subs of matching parent category
      } else if (matchingSubs.length > 0) {
        result[parent] = matchingSubs;
      }
    });
    return result;
  }, [grouped, searchQuery]);

  const clearAll = () => setSelected([]);
  const selectAll = () => {
    const allInFiltered = Object.values(filteredGrouped).flat();
    setSelected((prev) => Array.from(new Set([...prev, ...allInFiltered])));
  };

  return (
    <View style={styles.wrapper}>
      {/* Header info */}
      <View style={styles.headerRow}>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Selecione as especialidades em que você atua. Somente projetos nessas categorias
          aparecerão quando você buscar projetos próximos.
        </Text>
        {selected.length > 0 && (
          <View style={styles.badgeRow}>
            <Badge style={styles.badge}>{selected.length}</Badge>
            <Text style={styles.badgeLabel}>
              {selected.length === 1 ? 'especialidade selecionada' : 'especialidades selecionadas'}
            </Text>
          </View>
        )}
      </View>

      {/* Search */}
      <Searchbar
        placeholder="Buscar especialidade..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
        inputStyle={{ fontSize: 14 }}
      />

      {/* Bulk actions */}
      <View style={styles.bulkRow}>
        <Button
          compact
          mode="text"
          onPress={selectAll}
          disabled={loading || saving}
          textColor={colors.primary}
        >
          Selecionar visíveis
        </Button>
        <Button
          compact
          mode="text"
          onPress={clearAll}
          disabled={loading || saving || selected.length === 0}
          textColor={colors.error}
        >
          Limpar todos
        </Button>
      </View>

      <Divider />

      {/* Categories list */}
      {loading ? (
        <ActivityIndicator animating size="large" style={{ marginTop: 40 }} />
      ) : Object.keys(filteredGrouped).length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {searchQuery ? `Nenhuma especialidade encontrada para "${searchQuery}"` : 'Nenhuma especialidade disponível'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {Object.entries(filteredGrouped).map(([parent, subs]) => (
            <View key={parent} style={styles.group}>
              <Text variant="titleSmall" style={styles.groupTitle}>{parent}</Text>
              <View style={styles.chipsContainer}>
                {subs.map((sub) => {
                  const isSelected = selected.includes(sub);
                  return (
                    <Chip
                      key={sub}
                      selected={isSelected}
                      onPress={() => toggle(sub)}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      textStyle={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                      showSelectedOverlay={false}
                    >
                      {sub}
                    </Chip>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <Button mode="outlined" onPress={() => navigation.goBack()} disabled={saving} style={styles.actionBtn}>
          Cancelar
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.actionBtn}
        >
          Salvar
        </Button>
      </View>

      <Snackbar visible={!!msg} onDismiss={() => setMsg(null)}>{msg}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F9FAFB' },
  headerRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  subtitle: { color: '#6B7280', lineHeight: 20 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  badge: { backgroundColor: colors.primary },
  badgeLabel: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  searchBar: { marginHorizontal: 12, marginBottom: 4, backgroundColor: '#FFFFFF', elevation: 1 },
  bulkRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8, paddingVertical: 4 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 120 },
  group: { marginTop: 16 },
  groupTitle: {
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  chipSelected: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  chipText: { color: '#374151', fontSize: 13 },
  chipTextSelected: { color: colors.primary, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  actionBtn: { flex: 1 },
});

