import React, { useState, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Card, Portal, Modal, Button, useTheme, IconButton, Divider, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useSettingsStore from '../stores/settingsStore';
import useAuthStore from '../stores/authStore';
import useProjectsNearbyStore from '../stores/projectsNearbyStore';
import useLocationStore from '../stores/locationStore';
import DynamicIcon from './DynamicIcon';
import { colors } from '../theme/colors';


export default function NearbySummary() {
  const theme = useTheme();
  const navigation = useNavigation();
  const projectsAll = useProjectsNearbyStore((s) => s.projectsAll);
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
  const [tempRadiusStr, setTempRadiusStr] = useState<string>(String(10));
  const [inputError, setInputError] = useState<string | null>(null);

  const locationText = useLocationStore((s) => s.locationText || '—');

  // radar pulse animation
  const radarAnim = useRef(new Animated.Value(1)).current;
  const radarOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const scale = Animated.loop(
      Animated.sequence([
        Animated.timing(radarAnim, { toValue: 1.9, duration: 2800, useNativeDriver: true }),
        Animated.timing(radarAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
      ])
    );
    const opacity = Animated.loop(
      Animated.sequence([
        Animated.timing(radarOpacity, { toValue: 0, duration: 2800, useNativeDriver: true }),
        Animated.timing(radarOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
      ])
    );
    scale.start();
    opacity.start();
    return () => { scale.stop(); opacity.stop(); };
  }, [radarAnim, radarOpacity]);

  // Carregar configurações do servidor quando o componente montar
  useEffect(() => {
    if (token) {
      loadFromServer(token);
    }
  }, [token]);

  // Sincronizar tempRadius com o valor do store quando ele mudar
  useEffect(() => {
    setTempRadius(serviceRadiusKm ?? 10);
    setTempRadiusStr(String(serviceRadiusKm ?? 10));
  }, [serviceRadiusKm]);

  const total = projectsAll?.length ?? 0;


  function openRadiusModal() {
    setTempRadius(serviceRadiusKm ?? 10);
    setTempRadiusStr(String(serviceRadiusKm ?? 10));
    setInputError(null);
    setVisible(true);
  }

  async function handleRefresh() {
    if (coords) {
      await fetchProjectsNearby({ token: token ?? undefined, latitude: coords[1], longitude: coords[0] });
    } else {
      await fetchProjectsNearby({ token: token ?? undefined });
    }
  }

  // Atualizar a função saveRadius para garantir que valores inválidos não sejam gravados
  async function saveRadius() {
    const parsed = parseFloat(tempRadiusStr);
    if (isNaN(parsed) || parsed <= 0 || parsed > 70) {
      setInputError('Insira um número válido entre 0 e 70');
      return; // Impede qualquer tentativa de salvar valores inválidos
    }

    // Apenas grava se o valor for válido
    setServiceRadiusKm(parsed);

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

    setVisible(false); // Fecha o modal apenas após salvar com sucesso
  }
  return (

    <Card style={styles.cardRoot} elevation={2}>
      <View style={styles.headerRow}>
        <View style={styles.leftHeader}>
          <View style={styles.radarWrapper}>
            <Animated.View style={[styles.radarPing, { transform: [{ scale: radarAnim }], opacity: radarOpacity }]} />
            <View style={styles.radarIcon}><DynamicIcon name='radar' size={20} color={colors.primary} /></View>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Projetos Próximos</Text>
            <Text style={styles.headerSubtitle}><DynamicIcon name='location-on' size={12} color={colors.primary} /> {locationText}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <IconButton icon="tune" size={20} onPress={openRadiusModal} accessibilityLabel="Ajustar Raio" style={styles.smallIcon} />
          <IconButton icon="refresh" size={20} onPress={handleRefresh} accessibilityLabel="Atualizar" style={styles.smallIcon} />
        </View>
      </View>

      <Card.Content>
        <View style={styles.statsRow}>
          <View style={styles.statColumn}>
            <Text style={styles.statLabel}>Raio Atual</Text>
            <Text style={styles.statValue}>{serviceRadiusKm ?? 10} <Text style={styles.statUnit}>km</Text></Text>
          </View>

          <View style={styles.dividerVertical} />

          <View style={styles.statColumnRight}>
            <Text style={styles.statLabel}>Encontrado</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{total < 10 ? `0${total}` : total} </Text>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.85} style={[styles.ctaButton, styles.ctaSolid]} onPress={() => (navigation as any).navigate('ProjectsList')} accessibilityRole="button">
          <Text style={[styles.ctaText, styles.ctaSolidText]}>VISUALIZAR PROJETOS</Text>
          <DynamicIcon name='arrow-right' color='#fff' size={16} />
        </TouchableOpacity>

      </Card.Content>

      {/* Modal para editar o raio (aceita somente float) */}
      <Portal>
        <Modal
          visible={visible}
          onDismiss={() => setVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Editar Raio de Detecção (km)</Text>
          <TextInput
            label="Raio (km)"
            value={tempRadiusStr}
            onChangeText={(text) => {
              // Permitir apenas números entre 0 e 70 enquanto digita
              if (text === '' || (/^[0-9]*\.?[0-9]*$/.test(text) && parseFloat(text) <= 70)) {
                setTempRadiusStr(text);
                setInputError(null);
              } else if (parseFloat(text) > 70) {
                setInputError('O valor não pode ser maior que 70');
              }
            }}
            keyboardType="numeric"
            mode="outlined"
            style={styles.textInput}
          />
          {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}
          <View style={styles.buttonRow}>
            <Button onPress={() => setVisible(false)} compact>Cancelar</Button>
            <Button
              mode="contained"
              onPress={saveRadius}
              style={styles.saveButton}
              disabled={isNaN(parseFloat(tempRadiusStr)) || parseFloat(tempRadiusStr) <= 0 || parseFloat(tempRadiusStr) > 70}
            >
              Salvar
            </Button>
          </View>
        </Modal>
      </Portal>
    </Card>






  )
}

const styles = StyleSheet.create({
  cardRoot: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    paddingBottom: 20
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    backgroundColor: '#fff',
  },
  leftHeader: { flexDirection: 'row', alignItems: 'center' },
  radarWrapper: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radarPing: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,109,88,0.18)' },
  radarIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,109,88,0.06)' },
  headerText: {},
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  headerSubtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  smallIcon: { margin: 0 },

  statsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, paddingTop: 6 },
  statColumn: { flex: 1 },
  dividerVertical: { width: 1, backgroundColor: '#eef2f7', height: 48, marginHorizontal: 8 },
  statColumnRight: { flex: 1, alignItems: 'flex-end' },
  statLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  statUnit: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },

  ctaButton: { marginTop: 12, paddingHorizontal: 12 },
  ctaSolid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 },
  ctaSolidText: { color: '#fff', fontWeight: '800', marginRight: 8 },
  ctaText: { color: '#fff', fontWeight: '800', marginRight: 8 },

  cardContent: {
    paddingBottom: 16,
  },
  titleStyle: {
    color: colors.primary,
    fontWeight: 'bold',
    alignSelf: 'center',
  },
  subtitleStyle: {
    color: colors.textSecondary,
    alignSelf: 'center',
  },
  divider: {
    marginVertical: 8,
    backgroundColor: colors.border,
    height: 1,
  },
  centerContainer: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
  centerText: {
    fontSize: 16,
    fontWeight: '500',
    alignSelf: 'center',
  },
  touchable: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    padding: 16,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  textInput: {
    marginBottom: 8,
  },
  errorText: {
    color: colors.error,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  saveButton: {
    marginLeft: 8,
  },
});