import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Card, Paragraph, Portal, Modal, Button, useTheme, IconButton } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import useSettingsStore from '../stores/settingsStore';
import useAuthStore from '../stores/authStore';
import useProjectsNearbyStore from '../stores/projectsNearbyStore';
import useLocationStore from '../stores/locationStore';

export default function NearbySummary() {
  const theme = useTheme();
  const projectsAll = useProjectsNearbyStore((s) => s.projectsAll);
  const projectsNonRemote = useProjectsNearbyStore((s) => s.projectsNonRemote);
  const fetchProjectsNearby = useProjectsNearbyStore((s) => s.fetchProjectsNearby);
  const loading = useProjectsNearbyStore((s) => s.loading);
  
  const serviceRadiusKm = useSettingsStore((s) => s.service_radius_km);
  const loadFromServer = useSettingsStore((s) => s.loadFromServer);
  const saveToServer = useSettingsStore((s) => s.saveToServer);
  const setServiceRadiusKm = useSettingsStore((s) => s.setServiceRadiusKm);
  const token = useAuthStore((s) => s.token);
  const coords = useLocationStore((s) => s.coords);

  const [visible, setVisible] = useState(false);
  const [tempRadius, setTempRadius] = useState<number>(10);

  // Carregar configurações do servidor quando o componente montar
  useEffect(() => {
    if (token) {
      loadFromServer(token);
    }
  }, [token]);

  // Sincronizar tempRadius com o valor do store quando ele mudar
  useEffect(() => {
    setTempRadius(serviceRadiusKm ?? 10);
  }, [serviceRadiusKm]);

  const total = projectsAll?.length ?? 0;
  const nonRemote = projectsNonRemote?.length ?? 0;
  const remote = Math.max(0, total - nonRemote);

  function openRadiusModal() {
    setTempRadius(serviceRadiusKm ?? 10);
    setVisible(true);
  }

  async function handleRefresh() {
    if (coords) {
      await fetchProjectsNearby({ token: token ?? undefined, latitude: coords[1], longitude: coords[0] });
    } else {
      await fetchProjectsNearby({ token: token ?? undefined });
    }
  }

  async function saveRadius() {
    setServiceRadiusKm(tempRadius);

    if (token) {
      try {
        await saveToServer(token);
        // Recarregar projetos após salvar (backend usará o novo raio)
        await handleRefresh();
      } catch (err) {
        console.warn('Erro ao salvar configurações:', err);
      }
    } else {
      console.warn('No token; configuração salva apenas localmente');
    }

    setVisible(false);
  }

  return (
    <>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}> 
        <Card.Title
          title="Projetos Próximos"
          titleStyle={styles.cardTitle}
          left={(props) => <IconButton {...props} icon="map-marker-radius" size={24} iconColor={theme.colors.primary} />}
        />
        <Card.Content style={styles.content}>
          <View style={styles.contentRow}>
            <View style={styles.info}>
              <View style={styles.row}>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{total}</Text>
                  <Paragraph style={styles.label}>Total</Paragraph>
                </View>
                <View style={styles.separator} />

                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{serviceRadiusKm ?? 10} km</Text>
                  <Paragraph style={styles.label}>Raio</Paragraph>
                </View>
                <View style={styles.separator} />

                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{nonRemote}</Text>
                  <Paragraph style={styles.label}>Não-remotos</Paragraph>
                </View>
                <View style={styles.separator} />

                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{remote}</Text>
                  <Paragraph style={styles.label}>Remotos</Paragraph>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <Text style={styles.actionsLabel}>Ações</Text>
              <View style={styles.actionButtons}>
                <IconButton
                  icon={loading ? 'loading' : 'reload'}
                  iconColor={theme.colors.primary}
                  size={24}
                  onPress={handleRefresh}
                  disabled={loading}
                />
                <IconButton
                  icon="tune"
                  iconColor={theme.colors.primary}
                  size={24}
                  onPress={openRadiusModal}
                />
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Portal>
        <Modal visible={visible} onDismiss={() => setVisible(false)} contentContainerStyle={styles.modalContainer}>
          <Text style={styles.modalTitle}>Raio de Detecção</Text>
          <Paragraph style={styles.modalSubtitle}>Ajuste o raio para buscar projetos próximos</Paragraph>
          
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>{tempRadius} km</Text>
            <Slider
              value={tempRadius}
              onValueChange={(v: number) => setTempRadius(Math.round(v))}
              minimumValue={1}
              maximumValue={500}
              step={1}
              style={styles.slider}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor="#ddd"
              thumbTintColor={theme.colors.primary}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>1 km</Text>
              <Text style={styles.sliderLabelText}>500 km</Text>
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setVisible(false)}>Cancelar</Button>
            <Button mode="contained" onPress={saveRadius}>Aplicar</Button>
          </View>
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', marginVertical: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  content: { paddingVertical: 8, paddingHorizontal: 12 },
  contentRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  
  info: { flex: 1, paddingRight: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stat: { alignItems: 'center', flex: 1, paddingVertical: 8 },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#222' },
  label: { fontSize: 11, color: '#666', marginTop: 4, textTransform: 'uppercase' },
  separator: { width: 1, backgroundColor: '#e0e0e0', height: 50, alignSelf: 'center' },

  actions: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  actionsLabel: { fontSize: 10, color: '#666', marginBottom: 4, textTransform: 'uppercase', fontWeight: '600' },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  modalContainer: { backgroundColor: 'white', marginHorizontal: 24, padding: 24, borderRadius: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#222' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  sliderContainer: { marginBottom: 16 },
  sliderValue: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 16, color: '#222' },
  slider: { width: '100%', height: 40 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  sliderLabelText: { fontSize: 12, color: '#999' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
});
