import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Appbar, Button, Text, Switch } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { FlatList } from 'react-native';
import useProjectsNearbyStore from '../stores/projectsNearbyStore';
import ProjectCard from '../components/ProjectCard';
import useAuthStore from '../stores/authStore';

export default function ProjectsListScreen() {
  const navigation = useNavigation();
  const projectsNearby = useProjectsNearbyStore((s) => s.projectsAll);
  const projectsNonRemote = useProjectsNearbyStore((s) => s.projectsNonRemote);
  const [showRemotes, setShowRemotes] = React.useState(true);
  const projects = showRemotes ? projectsNearby : projectsNonRemote;

  const user = useAuthStore((s) => s.user);
  const isProfessional = Boolean(user && user.roles && user.roles.includes('professional'));

  const copyToClipboard = (text: string) => {
    console.log(text)
  }

  return (
    <View style={styles.container}>
      <View>
        <Switch
          value={showRemotes}
          onValueChange={() => setShowRemotes(!showRemotes)}
        />
        <Text>Mostrar projetos remotos</Text>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => (item._id ? String(item._id) : Math.random().toString())}
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>
            <ProjectCard project={item} showStatus detailRoute={isProfessional ? 'ProjectProfessionalsDetail' : undefined} />
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.body}>
            <Text>Nenhum projeto disponível.</Text>
          </View>
        )}
        contentContainerStyle={{ padding: 12 }}
      />
    
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
  itemWrapper: { paddingVertical: 6 },
});
