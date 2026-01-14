import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Searchbar, Divider, ActivityIndicator, Text } from 'react-native-paper';
import ProjectCard from '../components/ProjectCard';
import useAuthStore from '../stores/authStore';
import { getProjects, Project } from '../api/projects';
import { useRoute } from '@react-navigation/native';

export default function AllProjectsScreen() {
  const navigation = useNavigation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>('');

  const route = useRoute();
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const params = { limit: 100 } as any;
        const routeParams = (route as any).params;
        if (routeParams?.category) params.category = routeParams.category;
        if (routeParams?.subcategories) params.subcategories = routeParams.subcategories;
        const res = await getProjects(params);
        if (mounted) setProjects(res);
      } catch (err) {
        console.warn('Erro ao buscar projetos:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => (p.description ?? '').toLowerCase().includes(q) || (p.title ?? '').toLowerCase().includes(q));
  }, [projects, query]);

  const user = useAuthStore((s) => s.user);
  const isProfessional = Boolean(user && user.roles && user.roles.includes('professional'));

  const renderItem = ({ item }: { item: Project }) => (
    <ProjectCard project={item} showStatus detailRoute={isProfessional ? 'ProjectProfessionalsDetail' : undefined} />
  );

  if (loading) return (
    <View style={styles.loader}><ActivityIndicator animating size="large" /></View>
  );

  return (
    <View style={styles.container}>
      <Searchbar placeholder="Buscar por descrição ou título..." value={query} onChangeText={setQuery} style={styles.search} />
      <Divider />
      {filtered.length === 0 ? (
        <View style={styles.empty}><Text>Nenhum projeto encontrado.</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => item.id ?? `${idx}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  search: { margin: 12 },
  card: { marginBottom: 12 },
  empty: { padding: 20, alignItems: 'center', justifyContent: 'center' },
});
