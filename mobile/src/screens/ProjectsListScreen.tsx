import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, Switch, Chip, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { FlatList } from 'react-native';
import useProjectsNearbyStore from '../stores/projectsNearbyStore';
import useSettingsStore from '../stores/settingsStore';
import ProjectCard from '../components/ProjectCard';
import useAuthStore from '../stores/authStore';
import { colors } from '../theme/colors';
import { Project } from '../api/projects';

/** Return the subcategory string from a project's category field (handles both string and object). */
function getProjectSub(project: Project): string {
  if (!project.category) return '';
  if (typeof project.category === 'string') return project.category;
  return (project.category as { main: string; sub: string }).sub || '';
}

export default function ProjectsListScreen() {
  const navigation = useNavigation();
  const projectsAll = useProjectsNearbyStore((s) => s.projectsAll);
  const projectsNonRemote = useProjectsNearbyStore((s) => s.projectsNonRemote);
  const [showRemotes, setShowRemotes] = React.useState(true);

  // Specialty filter from settings store (what the professional has selected)
  const savedSubcategories = useSettingsStore((s) => s.subcategories) ?? [];

  // Local active-filter state: default = all saved subcategories
  const [activeFilters, setActiveFilters] = React.useState<string[]>(() => savedSubcategories);

  // Keep activeFilters in sync when savedSubcategories change (e.g., after returning from EditProfessionalSettings)
  React.useEffect(() => {
    setActiveFilters(savedSubcategories);
  }, [JSON.stringify(savedSubcategories)]);

  const user = useAuthStore((s) => s.user);
  const isProfessional = Boolean(user && user.roles && user.roles.includes('professional'));

  const baseProjects = showRemotes ? projectsAll : projectsNonRemote;

  // Client-side filter: if the professional has active specialty filters, apply them.
  const filteredProjects = useMemo(() => {
    if (!isProfessional || activeFilters.length === 0) return baseProjects;
    return baseProjects.filter((p) => activeFilters.includes(getProjectSub(p)));
  }, [baseProjects, activeFilters, isProfessional]);

  const toggleFilter = (sub: string) => {
    setActiveFilters((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  const showingAll = activeFilters.length === 0 || activeFilters.length === savedSubcategories.length;

  return (
    <View style={styles.container}>
      {/* Remote toggle row */}
      <View style={styles.toggleRow}>
        <Switch value={showRemotes} onValueChange={() => setShowRemotes(!showRemotes)} />
        <Text style={styles.toggleLabel}>Mostrar projetos remotos</Text>
      </View>

      {/* Specialty filter bar — only show for professionals that have saved subcategories */}
      {isProfessional && savedSubcategories.length > 0 && (
        <View style={styles.filterBar}>
          <View style={styles.filterBarHeader}>
            <Text style={styles.filterBarTitle}>Filtrar por especialidade</Text>
            <IconButton
              icon="tune"
              size={18}
              onPress={() => (navigation as any).navigate('EditProfessionalSettings')}
              iconColor={colors.primary}
              style={styles.tuneBtn}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {/* "Todos" chip to clear filter */}
            <Chip
              selected={showingAll}
              onPress={() => setActiveFilters(savedSubcategories)}
              style={[styles.filterChip, showingAll && styles.filterChipActive]}
              textStyle={[styles.filterChipText, showingAll && styles.filterChipTextActive]}
              compact
            >
              Todos
            </Chip>
            {savedSubcategories.map((sub) => {
              const active = activeFilters.includes(sub);
              return (
                <Chip
                  key={sub}
                  selected={active}
                  onPress={() => toggleFilter(sub)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  textStyle={[styles.filterChipText, active && styles.filterChipTextActive]}
                  compact
                >
                  {sub}
                </Chip>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* No specialty configured hint */}
      {isProfessional && savedSubcategories.length === 0 && (
        <Button
          icon="star-outline"
          mode="text"
          compact
          textColor={colors.primary}
          onPress={() => (navigation as any).navigate('EditProfessionalSettings')}
          style={styles.addSpecialtiesBtn}
        >
          Configurar especialidades para filtrar projetos
        </Button>
      )}

      <FlatList
        data={filteredProjects}
        keyExtractor={(item) => (item._id ? String(item._id) : Math.random().toString())}
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>
            <ProjectCard project={item} showStatus detailRoute={isProfessional ? 'ProjectProfessionalsDetail' : undefined} />
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.body}>
            <Text style={styles.emptyText}>
              {activeFilters.length > 0 && activeFilters.length < savedSubcategories.length
                ? 'Nenhum projeto nas especialidades selecionadas.'
                : 'Nenhum projeto disponível.'}
            </Text>
            {activeFilters.length > 0 && activeFilters.length < savedSubcategories.length && (
              <Button
                compact
                mode="text"
                textColor={colors.primary}
                onPress={() => setActiveFilters(savedSubcategories)}
              >
                Mostrar todos
              </Button>
            )}
          </View>
        )}
        contentContainerStyle={{ padding: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  toggleLabel: { fontSize: 14, color: '#374151', marginLeft: 8 },
  filterBar: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  filterBarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterBarTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  tuneBtn: { margin: 0 },
  chipsRow: { flexDirection: 'row', gap: 6, paddingRight: 8 },
  filterChip: { borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '14' },
  filterChipText: { fontSize: 12, color: '#374151' },
  filterChipTextActive: { color: colors.primary, fontWeight: '700' },
  addSpecialtiesBtn: { marginHorizontal: 8, marginVertical: 4 },
  body: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 8 },
  itemWrapper: { paddingVertical: 6 },
});
