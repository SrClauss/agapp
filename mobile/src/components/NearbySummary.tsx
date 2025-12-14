import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Chip } from 'react-native-paper';
import useProjectsNearbyStore from '../stores/projectsNearbyStore';

export default function NearbySummary() {
  const projectsAll = useProjectsNearbyStore((s) => s.projectsAll);
  const projectsNonRemote = useProjectsNearbyStore((s) => s.projectsNonRemote);
  const lastRadiusKm = useProjectsNearbyStore((s) => s.lastRadiusKm);

  const total = projectsAll?.length ?? 0;
  const nonRemote = projectsNonRemote?.length ?? 0;
  const remote = Math.max(0, total - nonRemote);

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <Title style={styles.title}>Resumo rápido</Title>
        <View style={styles.row}>
          <View style={styles.col}>
            <Paragraph style={styles.label}>Total</Paragraph>
            <Chip mode="flat" compact>{total}</Chip>
          </View>
          <View style={styles.col}>
            <Paragraph style={styles.label}>Raio</Paragraph>
            <Chip mode="flat" compact>{lastRadiusKm ? `${lastRadiusKm} km` : '—'}</Chip>
          </View>
          <View style={styles.col}>
            <Paragraph style={styles.label}>Não-remotos</Paragraph>
            <Chip mode="flat" compact>{nonRemote}</Chip>
          </View>
          <View style={styles.col}>
            <Paragraph style={styles.label}>Remotos</Paragraph>
            <Chip mode="flat" compact>{remote}</Chip>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', marginVertical: 8 },
  content: { paddingVertical: 12 },
  title: { fontSize: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  col: { alignItems: 'center', flex: 1 },
  label: { fontSize: 12, color: '#666', marginBottom: 4 },
});
