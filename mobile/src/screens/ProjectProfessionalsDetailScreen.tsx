import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, ActivityIndicator, View, ImageBackground, Alert } from 'react-native';
import { Text, Card, Avatar, Button, Snackbar } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getProject, Project } from '../api/projects';
import { getCreditsByProfessional } from '../api/professional';
import { getContactCostPreview, createContactForProject, getContactHistory, CostPreview } from '../api/contacts';
import useAuthStore from '../stores/authStore';
import useChatStore from '../stores/chatStore';
import { maskName, maskPhone } from '../utils/format';
import ConfirmContactModal from '../components/ConfirmContactModal';
import { ProfileCard } from '../components/ProfileCard';

interface Params {
  projectId?: string;
  project?: Project;
}

export default function ProjectProfessionalsDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params ?? {}) as Params | undefined;
  const projectId = params?.projectId;
  const projectParam = params?.project;

  const [project, setProject] = useState<Project | null>(projectParam || null);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(!project);
  const [costPreview, setCostPreview] = useState<CostPreview | null>(null);
  const [loadingCostPreview, setLoadingCostPreview] = useState<boolean>(false);
  const [confirmVisible, setConfirmVisible] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [snackbarVisible, setSnackbarVisible] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [existingContactId, setExistingContactId] = useState<string | null>(null);

  const { user, setUser } = useAuthStore();
  const { openChat } = useChatStore();

  // Refs for debounce mechanism to prevent multiple rapid button presses
  const lastContactPressTime = useRef<number>(0);
  const isCreatingRef = useRef<boolean>(false);
  const DEBOUNCE_DELAY = 1000; // 1 second delay between button presses

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!project && projectId) {
        setLoading(true);
        try {
          const data = await getProject(projectId);
          if (mounted) setProject(data);
        } catch (e) {
          console.warn('[ProjectProfessionalsDetail] failed to fetch project', e);
        } finally {
          if (mounted) setLoading(false);
        }
      }
    };
    
    load();
    return () => { mounted = false; };
  }, [projectId]);

  // Load cost preview when project is loaded
  useEffect(() => {
    if (!project || !projectId || !user || !user.roles.includes('professional')) {
      return;
    }

    const loadPreview = async () => {
      setLoadingCostPreview(true);
      try {
        const preview = await getContactCostPreview(projectId);
        setCostPreview(preview);
        
        // If contact already exists, fetch the actual contact ID
        if (preview.reason === 'contact_already_exists') {
          try {
            const contacts = await getContactHistory('professional');
            const existingContact = contacts.find(c => c.project_id === projectId);
            if (existingContact) {
              setExistingContactId(existingContact.id);
            } else {
              setExistingContactId('existing'); // fallback
            }
          } catch (e) {
            console.warn('[ProjectProfessionalsDetail] failed to fetch existing contact', e);
            setExistingContactId('existing'); // fallback
          }
        }
      } catch (e: any) {
        console.warn('[ProjectProfessionalsDetail] failed to fetch cost preview', e);
        if (e?.response?.status === 404) {
          setSnackbarMessage('Projeto não encontrado');
          setSnackbarVisible(true);
        }
      } finally {
        setLoadingCostPreview(false);
      }
    };

    loadPreview();
  }, [project, projectId, user]);

  const handleContactButtonPress = useCallback(() => {
    console.log('[ProjectProfessionalsDetail] handleContactButtonPress called', {
      timestamp: Date.now(),
      costPreview: costPreview ? 'loaded' : 'null',
      creating: creating,
      isCreatingRef: isCreatingRef.current,
    });

    // Check debounce timing
    const now = Date.now();
    const timeSinceLastPress = now - lastContactPressTime.current;
    if (timeSinceLastPress < DEBOUNCE_DELAY) {
      console.log('[ProjectProfessionalsDetail] Button press ignored - debounce active', {
        timeSinceLastPress,
        debounceDelay: DEBOUNCE_DELAY,
      });
      return;
    }
    lastContactPressTime.current = now;

    // Check if already creating (belt-and-suspenders approach)
    if (creating || isCreatingRef.current) {
      console.log('[ProjectProfessionalsDetail] Button press ignored - already creating contact');
      return;
    }

    if (!costPreview) {
      console.log('[ProjectProfessionalsDetail] Button press ignored - no cost preview');
      setSnackbarMessage('Aguarde o carregamento das informações');
      setSnackbarVisible(true);
      return;
    }

    if (costPreview.reason === 'contact_already_exists') {
      console.log('[ProjectProfessionalsDetail] Opening existing contact chat', {
        existingContactId,
      });
      // Open existing contact chat
      if (existingContactId && existingContactId !== 'existing') {
        openChat(existingContactId);
      } else {
        setSnackbarMessage('Você já tem um contato com este projeto');
        setSnackbarVisible(true);
      }
      return;
    }

    if (!costPreview.can_afford) {
      console.log('[ProjectProfessionalsDetail] Insufficient credits', {
        currentBalance: costPreview.current_balance,
        cost: costPreview.credits_cost,
      });
      Alert.alert(
        'Créditos Insuficientes',
        'Você não tem créditos suficientes para contatar este projeto. Deseja comprar mais créditos?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Comprar Créditos',
            onPress: () => {
              // TODO: Navigate to credit purchase screen
              setSnackbarMessage('Funcionalidade de compra em desenvolvimento');
              setSnackbarVisible(true);
            },
          },
        ]
      );
      return;
    }

    console.log('[ProjectProfessionalsDetail] Opening confirm modal');
    setConfirmVisible(true);
  }, [costPreview, creating, existingContactId, openChat]);

  const handleConfirmContact = useCallback(async (message: string, proposalPrice?: number) => {
    console.log('[ProjectProfessionalsDetail] handleConfirmContact called', {
      timestamp: Date.now(),
      projectId,
      creating,
      isCreatingRef: isCreatingRef.current,
    });

    // Triple-check to prevent concurrent calls
    if (!projectId || creating || isCreatingRef.current) {
      console.log('[ProjectProfessionalsDetail] handleConfirmContact aborted - already creating or no projectId');
      return;
    }

    console.log('[ProjectProfessionalsDetail] Starting contact creation...');
    setCreating(true);
    isCreatingRef.current = true;

    try {
      console.log('[ProjectProfessionalsDetail] Calling createContactForProject API...');
      const contact = await createContactForProject(projectId, {
        contact_type: 'proposal',
        contact_details: {
          message,
          proposal_price: proposalPrice,
        },
      });

      console.log('[ProjectProfessionalsDetail] Contact created successfully', {
        contactId: contact.id,
      });

      // Refresh user credits
      try {
        console.log('[ProjectProfessionalsDetail] Refreshing user credits...');
        const creditsData = await getCreditsByProfessional();
        if (user) {
          setUser({ ...user, credits: creditsData.credits_available });
        }
        console.log('[ProjectProfessionalsDetail] Credits refreshed', {
          newBalance: creditsData.credits_available,
        });
      } catch (e) {
        console.warn('[ProjectProfessionalsDetail] failed to refresh credits', e);
      }

      setConfirmVisible(false);
      setSnackbarMessage('Contato criado com sucesso!');
      setSnackbarVisible(true);

      console.log('[ProjectProfessionalsDetail] Opening chat with new contact...');
      // Open chat with new contact
      openChat(contact.id);
    } catch (e: any) {
      console.error('[ProjectProfessionalsDetail] failed to create contact', {
        error: e,
        status: e?.response?.status,
        detail: e?.response?.data?.detail,
      });
      
      if (e?.response?.status === 400) {
        const detail = e?.response?.data?.detail || '';
        
        if (detail.includes('already exists') || detail.includes('Contact already exists')) {
          console.log('[ProjectProfessionalsDetail] Contact already exists error');
          setSnackbarMessage('Você já tem um contato com este projeto');
          setSnackbarVisible(true);
          setConfirmVisible(false);
          
          // Try to fetch the existing contact ID and open chat
          try {
            const contacts = await getContactHistory('professional');
            const existingContact = contacts.find(c => c.project_id === projectId);
            if (existingContact) {
              setExistingContactId(existingContact.id);
              openChat(existingContact.id);
            } else {
              setExistingContactId('existing');
            }
          } catch (e) {
            console.warn('[ProjectProfessionalsDetail] failed to fetch existing contact after creation', e);
            setExistingContactId('existing');
          }
        } else if (detail.includes('Insufficient credits')) {
          console.log('[ProjectProfessionalsDetail] Insufficient credits error');
          Alert.alert(
            'Créditos Insuficientes',
            'Você não tem créditos suficientes. Deseja comprar mais créditos?',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Comprar Créditos',
                onPress: () => {
                  setConfirmVisible(false);
                  // TODO: Navigate to credit purchase screen
                },
              },
            ]
          );
        } else {
          setSnackbarMessage(detail || 'Erro ao criar contato');
          setSnackbarVisible(true);
        }
      } else if (!e?.response) {
        // Network error
        console.log('[ProjectProfessionalsDetail] Network error');
        Alert.alert(
          'Erro de Conexão',
          'Não foi possível criar o contato. Verifique sua conexão e tente novamente.',
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Tentar Novamente',
              onPress: () => handleConfirmContact(message, proposalPrice),
            },
          ]
        );
      } else {
        setSnackbarMessage('Erro ao criar contato. Tente novamente.');
        setSnackbarVisible(true);
      }
    } finally {
      console.log('[ProjectProfessionalsDetail] Contact creation finished, resetting state');
      setCreating(false);
      isCreatingRef.current = false;
    }
  }, [projectId, creating, user, setUser, openChat]);
  
  const handleGetMe = async () => {
    console.log("[ProjectProfessionalsDetail] handleGetMe called");
    try {
      const me = await require('../api/axiosClient').default.get('users/me');
      console.log(me.data);
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (projectId) {
        getProject(projectId).then((data) => setProject(data)).catch((e) => console.warn('[ProjectProfessionalsDetail] failed to refetch on focus', e));
      }
    });
    return unsubscribe;
  }, [navigation, projectId]);

  useEffect(() => {
    let mounted = true;
    const loadClient = async () => {
      if (!project) return;
      const clientId = (project as any).client_id || (project as any).client || (project as any).clientId || (project as any).clientUid;
      if (!clientId) {
        if ((project as any).client_name && mounted) {
          setClientInfo({ full_name: (project as any).client_name, phone: (project as any).client_phone || null });
        }
        return;
      }

      try {
        const info = await require('../api/users').getUserPublic(clientId);
        if (mounted && info) {
          setClientInfo({ full_name: info.full_name || (project as any).client_name || null, phone: info.phone || null });
        }
      } catch (e: any) {
        console.warn('[ProjectProfessionalsDetail] failed to fetch public user', e?.response?.status || e);
        if (mounted) {
          if ((project as any).client_name || (project as any).client_phone) {
            setClientInfo({ full_name: (project as any).client_name || null, phone: (project as any).client_phone || null });
          } else {
            setClientInfo(null);
          }
        }
      }
    };
    loadClient();
    return () => { mounted = false; };
  }, [project]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Projeto não encontrado</Text>
      </View>
    );
  }

  const addressFormatted = (project.location?.address as any)?.formatted ||
    (project.location?.address ? String(project.location.address) : null) ||
    'Não informado';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return '#10B981'; // success
      case 'closed':
        return '#6B7280'; // secondary
      case 'in_progress':
        return '#3B82F6'; // info
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Aberto';
      case 'closed':
        return 'Fechado';
      case 'in_progress':
        return 'Em andamento';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '-';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getCategoryDisplay = (category: Project['category']) => {
    if (typeof category === 'string') return category;
    return `${category.main}${category.sub ? ` › ${category.sub}` : ''}`;
  };

  // Extrair cidade/estado de forma defensiva
  const addr = (project.location?.address as any) || {};
  const city = addr.city || addr.town || addr.village || addr.county || project.location?.city || '';
  const state = addr.state || addr.region || project.location?.state || '';
  const cityState = [city, state].filter(Boolean).join(' - ') || 'Não informado';

  const clientName = clientInfo?.full_name || project.client_name || '';
  const clientPhone = clientInfo?.phone || (project as any).client_phone || '';

  const liberadoresCount = project.liberado_por_profiles ? project.liberado_por_profiles.length : (project.liberado_por ? project.liberado_por.length : 0);

  return (
    <View style={styles.safeArea}>
      <ImageBackground source={require('../../assets/background.jpg')} style={styles.headerBackground} imageStyle={{ borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
        <View style={styles.headerContent}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <View style={[styles.statusRow, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.statusPill, { backgroundColor: getStatusColor(project.status) }]}>
                  <Text style={styles.statusPillText}>{getStatusLabel(project.status)}</Text>
                </View>
                <View style={[styles.datePill, { marginLeft: 8 }]}>
                  <Text style={[styles.dateText, { color: 'rgba(255,255,255,0.95)' }]}>Publicado em {formatDate(project.created_at)}</Text>
                </View>
              </View>

            </View>

            <Text style={[styles.headerTitleLarge, { textAlign: 'center' }]} numberOfLines={2}>{project.title}</Text>

          </View>
        </View>
      </ImageBackground>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.budgetCard}>
          <View style={styles.budgetLeft}>
            <View style={styles.budgetIcon}><Text>R$</Text></View>
            <View>
          
              <Text style={styles.budgetLabel}>Orçamento Estimado</Text>
              {project.budget_min && project.budget_max ? (
                <>
                  <Text style={styles.budgetValue}>A partir de {formatCurrency(project.budget_min)}</Text>
                  <Text style={styles.budgetValue}>Até {formatCurrency(project.budget_max)}</Text>
                </>
              ) : project.budget_min ? (
                <Text style={styles.budgetValue}>A partir de {formatCurrency(project.budget_min)}</Text>
              ) : project.budget_max ? (
                <Text style={styles.budgetValue}>Até {formatCurrency(project.budget_max)}</Text>
              ) : (
                <Text style={styles.budgetValue}>—</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardRounded}>
          <View style={styles.cardContentPadded}>
            <Text style={styles.sectionTitle}>Detalhes técnicos</Text>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}><Text>🔧</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Serviço</Text>
                <Text style={styles.detailTitle}>{getCategoryDisplay(project.category)}</Text>
                {typeof project.category !== 'string' && (project.category as any).sub ? (
                  <Text style={styles.detailSub}>{(project.category as any).sub}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}><Text>👤</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Cliente Responsável</Text>
                <Text style={styles.detailTitle}>{existingContactId ? (clientInfo?.full_name || project.client_name || '—') : maskName(clientName)}</Text>
              </View>
            </View>

            {(clientPhone) && (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}><Text>📞</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>Telefone do Cliente</Text>
                  <Text style={styles.detailTitle}>{existingContactId ? (clientInfo?.phone || (project as any).client_phone || '—') : maskPhone(clientPhone)}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}><Text>📍</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Local da Obra</Text>
                <Text style={styles.detailTitle}>{existingContactId ? addressFormatted : cityState}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardRounded}>
          <View style={styles.cardContentPadded}>
            <Text style={styles.sectionTitle}>Sobre o pedido</Text>
            <Text style={styles.description}>{project.description}</Text>
          </View>
        </View>

        {/* Client Profile Card - only show if contact exists */}
        {existingContactId && existingContactId !== 'existing' && clientInfo && (
          <View style={styles.cardRounded}>
            <View style={styles.cardContentPadded}>
              <Text style={styles.sectionTitle}>Cliente</Text>
              <ProfileCard
                name={clientInfo.full_name || project.client_name || 'Cliente'}
                email={clientInfo.email}
                phone={clientInfo.phone}
                avatarUrl={clientInfo.avatar_url}
                role="Cliente"
                onChatPress={() => openChat(existingContactId)}
              />
            </View>
          </View>
        )}

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Profissionais que liberaram</Text>
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', fontSize: 20 }}>{liberadoresCount}</Text>
              <Text style={{ color: '#6B7280' }}>{liberadoresCount === 1 ? 'profissional liberou' : 'profissionais liberaram'}</Text>
            </View>
          </Card.Content>
        </Card>

        {project.closed_by && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Projeto Fechado</Text>
              <View style={styles.closedByContainer}>
                <Avatar.Icon size={48} icon="check-circle" style={styles.closedAvatar} />
                <View style={styles.closedInfo}>
                  <Text style={styles.closedByName}>{project.closed_by_name || 'Profissional'}</Text>
                  {project.closed_at && (
                    <Text style={styles.closedDate}>Fechado em {formatDate(project.closed_at)}</Text>
                  )}
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        <View style={styles.actionsContainer}>
          {user && user.roles.includes('professional') && project.status === 'open' && (
            <>
              {loadingCostPreview ? (
                <ActivityIndicator size="large" style={{ marginVertical: 20 }} />
              ) : costPreview ? (
                existingContactId ? (
                  <Button
                    mode="outlined"
                    onPress={() => {
                      if (existingContactId && existingContactId !== 'existing') {
                        navigation.navigate('ContactDetail', { contactId: existingContactId });
                      } else {
                        setSnackbarMessage('Erro ao acessar conversa. Tente novamente.');
                        setSnackbarVisible(true);
                      }
                    }}
                    style={{ marginBottom: 8 }}
                  >
                    Ver Conversa Existente
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    onPress={handleContactButtonPress}
                    disabled={creating}
                    loading={creating}
                    style={{ marginBottom: 8 }}
                  >
                    {costPreview.can_afford
                      ? `Contatar — ${costPreview.credits_cost} créditos`
                      : 'Créditos Insuficientes'}
                  </Button>
                )
              ) : null}

              <Button
                mode="outlined"
                onPress={handleGetMe}
                style={{ marginBottom: 8 }}
              >
                Debug: Ver Meu Perfil
              </Button>
            </>
          )}
        </View>

        <ConfirmContactModal
          visible={confirmVisible}
          onDismiss={() => setConfirmVisible(false)}
          onConfirm={handleConfirmContact}
          costPreview={costPreview}
          loading={creating}
        />

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          action={{
            label: 'OK',
            onPress: () => setSnackbarVisible(false),
          }}
        >
          {snackbarMessage}
        </Snackbar>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({

  actionsContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
  },
  headerBackground: {
    height: 130,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    marginLeft: 20,
    marginRight: 20,
    overflow: 'hidden',
  },
  headerContent: { paddingHorizontal: 16, paddingTop: 14, alignItems: 'center', marginTop: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'center' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 8 },
  statusPillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  datePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  dateText: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  headerTitleLarge: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6 },
  scrollView: {
    flex: 1,
    marginBottom: 30
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  cardRounded: {
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
    overflow: 'hidden',
  },
  cardContentPadded: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  budgetCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  budgetLeft: { flexDirection: 'row', alignItems: 'center' },
  budgetIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#FAFAFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  budgetLabel: { fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: '800' },
  budgetValue: { fontSize: 18, fontWeight: '900', color: '#111827' },
  description: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  detailIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FAFAFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  detailLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase' },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  detailSub: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  professionalsContainer: {
    gap: 12,
  },
  professionalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  professionalAvatar: {
    backgroundColor: '#111827',
  },
  professionalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  professionalName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  professionalId: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  contactButtonPlaceholder: {
    padding: 8,
    opacity: 0.5,
  },
  futureFeatureText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyProfessionals: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyProfessionalsText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyProfessionalsHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  closedByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closedAvatar: {
    backgroundColor: '#10B981',
  },
  closedInfo: {
    marginLeft: 12,
  },
  closedByName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  closedDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  iconButton: {
    padding: 8,
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  headerActionsRight: { flexDirection: 'row', alignItems: 'center' },
});