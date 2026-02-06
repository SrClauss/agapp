import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { getContactedProjects } from '../api/professional';
import { useFocusEffect } from '@react-navigation/native';
import {ProjectContactedCard}  from '../components/ProjectContatedCard';
export default function ContactedProjectsScreen() {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContactedProjects(0, 50);
      setProjects(data);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id || item._id}
        renderItem={({ item }) => (
          <ProjectContactedCard project={item} />
        )}
        ListEmptyComponent={() => (
          <View style={styles.center}>
            <Text>Nenhum projeto encontrado.</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
});
