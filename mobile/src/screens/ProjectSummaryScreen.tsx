import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { useRoute } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { Project } from '../api/projects';
import { Avatar } from '../components/LocationAvatar';

interface Props {}

export default function ProjectSummaryScreen(props: Props) {
  const route = useRoute();
  const { project }: { project: Project } = route.params as any;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{project.title}</Text>
      <Text style={styles.desc}>{project.description}</Text>
      <Text style={styles.label}>Categoria:</Text>
      <Text>{typeof project.category === 'string' ? project.category : `${project.category?.main || ''} / ${project.category?.sub || ''}`}</Text>
      <Text style={styles.label}>Orçamento:</Text>
      <Text>R$ {project.budget_min?.toFixed(2)} - R$ {project.budget_max?.toFixed(2)}</Text>
      <Text style={styles.label}>Status:</Text>
      <Text>{project.status}</Text>
      <Text style={styles.label}>Data de criação:</Text>
      <Text>{new Date(project.created_at).toLocaleString()}</Text>
      <Text style={styles.label}>Cliente:</Text>
      <Text>{project.client_name || project.client_id}</Text>
      <Text style={styles.label}>Profissional:</Text>
      <Text>{(project as any).professional_name || (project as any).professional_id || '-'}</Text>
      <Text style={styles.label}>Localização:</Text>
      {project.location?.address && <Text>{project.location.address}</Text>}
      {project.location?.coordinates && project.location.coordinates.length === 2 && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: project.location.coordinates[1],
            longitude: project.location.coordinates[0],
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker
            coordinate={{
              latitude: project.location.coordinates[1],
              longitude: project.location.coordinates[0],
            }}
            title={project.title}
          />
        </MapView>
      )}
      <Text style={styles.label}>Liberado por:</Text>
      <View style={styles.avatarStack}>
        {project.liberado_por_profiles && project.liberado_por_profiles.length > 0 ? (
          project.liberado_por_profiles.map((profile, idx) => (
            <View key={profile.id || idx} style={styles.avatarItem}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.smallAvatar} />
              ) : (
                <View style={styles.smallFallback}><Text style={styles.smallFallbackText}>{(profile.full_name || profile.id || '').slice(0,2).toUpperCase()}</Text></View>
              )}
              <Text style={styles.avatarName}>{profile.full_name || profile.id}</Text>
            </View>
          ))
        ) : (
          <Text style={{color:'#888'}}>Nenhum liberador registrado</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  desc: { fontSize: 16, marginBottom: 8 },
  label: { fontWeight: 'bold', marginTop: 12 },
  map: { width: '100%', height: 180, marginVertical: 8, borderRadius: 8 },
  avatarStack: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  avatarItem: { alignItems: 'center', marginRight: 16, marginBottom: 8 },
  avatarName: { fontSize: 12, marginTop: 4, maxWidth: 60, textAlign: 'center' },
  smallAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#eee' },
  smallFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CCC', alignItems: 'center', justifyContent: 'center' },
  smallFallbackText: { color: '#fff', fontWeight: '700' },
});
