import React from 'react';
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Project } from '../api/projects';
import { Card, Title, Paragraph, Chip, Divider, Avatar as PaperAvatar, Button, useTheme } from 'react-native-paper';

interface Props {}

export default function ProjectSummaryScreen(props: Props) {
  const route = useRoute();
  const { project }: { project: Project } = route.params as any;
  const theme = useTheme();

  // Verificação segura das coordenadas
  const coords = Array.isArray(project.location?.coordinates) ? project.location!.coordinates as any[] : undefined;
  const hasCoords = coords && coords.length === 2;
  const lat = hasCoords ? coords![1] : undefined;
  const lng = hasCoords ? coords![0] : undefined;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <Card mode="elevated" style={styles.headerCard}>
        <Card.Content style={styles.header}>
          <Title numberOfLines={2} style={styles.headerTitle}>{project.title}</Title>
          <View style={styles.headerRight}>
            <Chip style={{ backgroundColor: project.status === 'open' ? '#3ddc84' : theme.colors.surface }} textStyle={{ color: theme.colors.onSurface }}>{project.status}</Chip>
          </View>
        </Card.Content>
        {project.description ? (
          <Card.Content>
            <Paragraph style={styles.desc}>{project.description}</Paragraph>
          </Card.Content>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Detalhes" subtitle={project.client_name || project.client_id} />
        <Card.Content>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Categoria</Text>
            <Text style={styles.infoValue}>{typeof project.category === 'string' ? project.category : `${project.category?.main || ''} / ${project.category?.sub || ''}`}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Orçamento</Text>
            <Text style={styles.infoValue}>R$ {project.budget_min?.toFixed(2) ?? '0.00'} - R$ {project.budget_max?.toFixed(2) ?? '0.00'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Data de criação</Text>
            <Text style={styles.infoValue}>{new Date(project.created_at).toLocaleString()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Profissional</Text>
            <Text style={styles.infoValue}>{(project as any).professional_name || (project as any).professional_id || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Localização</Text>
            <Text style={styles.infoValue}>{project.location?.address || '—'}</Text>
          </View>
          {hasCoords && (
            <Button mode="contained" onPress={() => { const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`; Linking.openURL(url); }} style={styles.mapButton}>
              Abrir no mapa
            </Button>
          )}
        </Card.Content>
      </Card>
      <Text style={styles.label}>Liberado por:</Text>
      <View style={styles.avatarStack}>
        {project.liberado_por_profiles && project.liberado_por_profiles.length > 0 ? (
          project.liberado_por_profiles.map((profile, idx) => (
            <View key={profile.id || idx} style={styles.avatarItem}>
              {profile.avatar_url ? (
                <PaperAvatar.Image size={40} source={{ uri: profile.avatar_url }} />
              ) : (
                <PaperAvatar.Text size={40} label={(profile.full_name || profile.id || '').slice(0,2).toUpperCase()} />
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
  headerCard: { marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerRight: { marginLeft: 8 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  desc: { fontSize: 16, marginBottom: 8 },
  label: { fontWeight: 'bold', marginTop: 12 },
  card: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  infoLabel: { color: '#666', fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#333', maxWidth: '70%', textAlign: 'right' },
  map: { width: '100%', height: 180, marginVertical: 8, borderRadius: 8 },
  avatarStack: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  avatarItem: { alignItems: 'center', marginRight: 12, marginBottom: 8, width: 70 },
  avatarName: { fontSize: 12, marginTop: 6, maxWidth: 70, textAlign: 'center' },
  liberadoTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  avatarItem: { alignItems: 'center', marginRight: 12, marginBottom: 8, width: 70 },
  avatarName: { fontSize: 12, marginTop: 6, maxWidth: 70, textAlign: 'center' },
  mapFallback: { padding: 12, backgroundColor: '#f7f7f7', borderRadius: 8, marginVertical: 8 },
  mapButton: { marginTop: 8, backgroundColor: '#007bff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, alignSelf: 'flex-start' },
  mapButtonText: { color: '#fff', fontWeight: '600' },
});
