import React, { useState, useEffect } from 'react';
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

      <Card.Title
        title="Projetos Próximos"
        titleStyle={styles.titleStyle}
        subtitle={loading ? 'Carregando...' : `${total} projeto(s) encontrado(s)`}
        subtitleStyle={styles.subtitleStyle}
        left={(props) => <DynamicIcon color={colors.primary} name="location-on" size={36} />}
        right={(props) => (

          <>
            <IconButton
              icon="tune"
              size={28}
              onPress={openRadiusModal}
              accessibilityLabel="Configurar raio de detecção"
            />
            <IconButton
              icon="refresh"
              size={28}
              onPress={handleRefresh}
              accessibilityLabel="Atualizar lista de projetos"
            />



          </>

        )}
      />
      <Card.Content>


        <Divider style={styles.divider} />
        <View>
          <View style={styles.centerContainer}>
            <Text style={styles.centerText}>Raio de Serviço</Text>
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('ProjectsList')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Abrir lista de projetos"
              style={styles.touchable}
            >
              <DynamicIcon name='radar' size={24} color={colors.info} />
              <Text style={{ fontSize: 24, marginLeft: 8 }}> {serviceRadiusKm ?? 'N/A'} km</Text>
            </TouchableOpacity>
          </View>
        </View>
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
      </Card.Content>
    </Card>






  )
}

const styles = StyleSheet.create({
  cardRoot: {
    width: '100%',
    marginBottom: 16,
  },
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