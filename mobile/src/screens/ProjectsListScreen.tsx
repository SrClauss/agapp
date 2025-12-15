import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Appbar, Button, Text, Switch } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { FlatList } from 'react-native';
import useProjectsNearbyStore from '../stores/projectsNearbyStore';
import CardProjeto from './CardProjeto';

export default function ProjectsListScreen() {
  const navigation = useNavigation();
  const projectsNearby = useProjectsNearbyStore((s) => s.projectsAll);
  const [showRemotes, setShowRemotes] = React.useState(true);

  

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
        data={projectsNearby}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View>

            <CardProjeto projeto={item} onPress={() => console.log("pressed")} />
            <Text>{JSON.stringify(item, null, 2)}</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.body}>
            <Text>Nenhum projeto disponível.</Text>
          </View>
        )}
      />
      
    
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
});
