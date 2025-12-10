import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Project } from '../api/projects';
import { Card, Title, Paragraph, Chip, Divider, Avatar as PaperAvatar, List, useTheme } from 'react-native-paper';

interface Props {}

export default function ProjectSummaryScreen(props: Props) {
  const route = useRoute();
  const { project }: { project: Project } = route.params as any;
  const theme = useTheme();

  // Preparar texto de feedback dos liberadores
  const liberadores = project?.liberado_por_profiles || [];
  const liberadoresNames = liberadores.map(p => p.full_name || p.id || '—');
  const liberadoresLabel = liberadoresNames.length === 0
    ? ''
    : liberadoresNames.length <= 3
      ? liberadoresNames.join(', ')
      : `${liberadoresNames.slice(0, 3).join(', ')} e mais ${liberadoresNames.length - 3}`;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}> 
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
      <Card mode="elevated" style={styles.headerCard}>
        <Card.Content>
          <View style={styles.headerTop}>
            <Title style={styles.projectTitle}>{project.title}</Title>
            <Chip mode="flat" style={styles.statusChip} textStyle={styles.statusText}>
              {project.status === 'open' ? 'Aberto' : project.status === 'closed' ? 'Fechado' : project.status}
            </Chip>
          </View>
          {project.description ? (
            <Paragraph style={styles.description}>{project.description}</Paragraph>
          ) : null}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Informações" titleStyle={styles.cardTitle} />
        <List.Item
          title="Cliente"
          description={project.client_name || project.client_id}
          left={props => <List.Icon {...props} icon="account" />}
        />
        <Divider />
        <List.Item
          title="Categoria"
          description={typeof project.category === 'string' ? project.category : `${project.category?.main || ''} / ${project.category?.sub || ''}`}
          left={props => <List.Icon {...props} icon="shape" />}
        />
        <Divider />
        <List.Item
          title="Orçamento"
          description={`R$ ${project.budget_min?.toFixed(2) ?? '0.00'} - R$ ${project.budget_max?.toFixed(2) ?? '0.00'}`}
          left={props => <List.Icon {...props} icon="cash" />}
        />
        <Divider />
        <List.Item
          title="Data de criação"
          description={new Date(project.created_at).toLocaleDateString('pt-BR')}
          left={props => <List.Icon {...props} icon="calendar" />}
        />
        {project.location?.address && (
          <>
            <Divider />
            <List.Item
              title="Localização"
              description={project.location.address}
              left={props => <List.Icon {...props} icon="map-marker" />}
            />
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Liberado por" titleStyle={styles.cardTitle} />
        <Card.Content>
          {liberadores.length > 0 ? (
            <>
              <View style={styles.avatarStack}>
                {liberadores.map((profile, idx) => (
                  <View key={profile.id || idx} style={styles.avatarItem}>
                    {profile.avatar_url ? (
                      <PaperAvatar.Image size={48} source={{ uri: profile.avatar_url }} />
                    ) : (
                      <PaperAvatar.Text size={48} label={(profile.full_name || profile.id || '').slice(0,2).toUpperCase()} />
                    )}
                    <Text style={styles.avatarName} numberOfLines={2}>{profile.full_name || profile.id}</Text>
                  </View>
                ))}
              </View>
              <Paragraph style={styles.liberadoresFeedback}>Liberadores: {liberadoresLabel}</Paragraph>
            </>
          ) : (
            <Paragraph style={styles.emptyText}>Até agora ninguém liberou este projeto.</Paragraph>
          )}
        </Card.Content>
      </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  safeArea: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 36 },
  headerCard: { marginBottom: 16 },
  headerTop: { marginBottom: 12 },
  projectTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8, lineHeight: 32 },
  statusChip: { alignSelf: 'flex-start', marginBottom: 8 },
  statusText: { fontSize: 12 },
  description: { fontSize: 15, lineHeight: 22, color: '#555' },
  card: { marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  avatarStack: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  avatarItem: { alignItems: 'center', width: 80 },
  avatarName: { fontSize: 12, marginTop: 8, textAlign: 'center', color: '#333' },
  liberadoresFeedback: { marginTop: 8, color: '#444', fontSize: 14 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
});
