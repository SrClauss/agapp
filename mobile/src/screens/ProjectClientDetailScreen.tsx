import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, SafeAreaView, ActivityIndicator, View, ImageBackground, Alert, Modal } from 'react-native';
import { Text, Card, Avatar, Divider, IconButton, Button, RadioButton, TextInput } from 'react-native-paper';
import { useRoute, useNavigation, NavigationProp } from '@react-navigation/native';
import { getProject, Project, updateProject, deleteProject, getProjectContacts, ContactSummary, closeProject } from '../api/projects';
import { getFeaturedPricing, createFeaturedProjectPayment } from '../api/payments';
import { getUserPublic } from '../api/users';
import useAuthStore from '../stores/authStore';
import { colors } from '../theme/colors';
import ProjectContactsList from '../components/ProjectContactsList';
import EvaluationModal from '../components/EvaluationModal';
import { evaluateProject } from '../api/projects';

// Tipagem da rota
interface Params {
  projectId?: string;
  project?: Project;
}

type RootStackParamList = {
  ContactDetail: { contactId: string };
  [key: string]: any;
};


const ProjectClientDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params ?? {}) as Params | undefined;
  const projectId = params?.projectId;
  const projectParam = params?.project;

  const [project, setProject] = useState<Project | null>(projectParam || null);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(!project);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Close project modal state
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);
  const [finalValue, setFinalValue] = useState('');
  const [closingProject, setClosingProject] = useState(false);
  const [evaluationVisible, setEvaluationVisible] = useState(false);

  // Featured project modal state
  const [featuredModalVisible, setFeaturedModalVisible] = useState(false);
  const [featuredPricing, setFeaturedPricing] = useState<any[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [featuring, setFeaturing] = useState(false);

  const { user } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!project && projectId) {
        setLoading(true);
        try {
          const data = await getProject(projectId);
          if (mounted) setProject(data);
        } catch (e) {
          console.warn('[ProjectClientDetail] failed to fetch project', e);
        } finally {
          if (mounted) setLoading(false);
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, [projectId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (projectId) {
        getProject(projectId).then((data) => {
          setProject(data);
        }).catch((e) => {
          console.warn('[ProjectClientDetail] failed to refetch project on focus', e);
        });
      }
    });
    return unsubscribe;
  }, [navigation, projectId]);

  useEffect(() => {
    let mounted = true;
    const loadClient = async () => {
      if (!project) return;

      // Suportar possíveis variações de campo que armazenam o id do cliente
      const clientId = (project as any).client_id || (project as any).client || (project as any).clientId || (project as any).clientUid;

      if (!clientId) {
        // Se não houver clientId, mas existir client_name no projeto, preencher cliente com o que houver (melhor do que nada)
        if ((project as any).client_name && mounted) {
          setClientInfo({ full_name: (project as any).client_name, phone: (project as any).client_phone || null });
        }
        return;
      }

      try {
        // Sempre tentar buscar a informação pública completa do usuário pelo id
        const info = await getUserPublic(clientId);
        if (mounted && info) {
          // Garantir que temos ambos full_name e phone quando disponíveis
          setClientInfo({ full_name: info.full_name || (project as any).client_name || null, phone: info.phone || null });
        }
      } catch (e: any) {
        console.warn('[ProjectClientDetail] failed to fetch public user', e?.response?.status || e);
        // Fallback: se a API pública não retornar dados, use client_name do projeto se disponível
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

  // Load contacts for the project
  useEffect(() => {
    if (!project || !projectId) return;
    
    const loadContacts = async () => {
      setLoadingContacts(true);
      try {
        const contactsData = await getProjectContacts(projectId);
        setContacts(contactsData);
      } catch (e) {
        console.warn('[ProjectClientDetail] failed to load contacts', e);
      } finally {
        setLoadingContacts(false);
      }
    };
    
    loadContacts();
  }, [project, projectId]);

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

  const handleDelete = async () => {

    if (!project) return;
    try {
      await deleteProject(project._id);
      Alert.alert('Sucesso', 'Projeto excluído com sucesso.');
      navigation.goBack();
    } catch (e) {
      
      Alert.alert('Erro', 'Falha ao excluir projeto.');
    }
  };

  const handleOpenCloseModal = () => {
    setSelectedProfessionalId(contacts.length > 0 ? contacts[0].professional_id : null);
    setFinalValue('');
    setCloseModalVisible(true);
  };

  const handleCloseProject = async () => {
    if (!project) return;
    setClosingProject(true);
    try {
      const finalValueNum = finalValue ? parseFloat(finalValue.replace(',', '.')) : undefined;
      await closeProject(project._id, {
        professional_id: selectedProfessionalId ?? undefined,
        final_budget: finalValueNum,
      });
      setCloseModalVisible(false);
      // Reload project
      const updated = await getProject(project._id);
      setProject(updated);
      // Prompt for evaluation
      setTimeout(() => setEvaluationVisible(true), 800);
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.detail || 'Falha ao concluir projeto.');
    } finally {
      setClosingProject(false);
    }
  };

  const handleSubmitEvaluation = async (rating: number, comment: string, wouldRecommend: boolean) => {
    if (!project) return;
    try {
      await evaluateProject(project._id, { rating, comment, would_recommend: wouldRecommend });
      setEvaluationVisible(false);
      Alert.alert('Obrigado!', 'Sua avaliação foi enviada com sucesso.');
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.detail || 'Falha ao enviar avaliação.');
    }
  };

  const handleOpenFeaturedModal = async () => {
    try {
      const pricing = await getFeaturedPricing();
      setFeaturedPricing(pricing);
      if (pricing.length > 0) setSelectedDuration(pricing[0].duration_days);
    } catch (e) {
      console.warn('[ProjectClientDetail] failed to load featured pricing', e);
    }
    setFeaturedModalVisible(true);
  };

  const handleFeatureProject = async () => {
    if (!project || !selectedDuration) return;
    setFeaturing(true);
    try {
      const result = await createFeaturedProjectPayment(project._id, selectedDuration, 'PIX');
      setFeaturedModalVisible(false);
      if (result.pix_payload) {
        Alert.alert(
          'QR Code PIX',
          `Copie o código PIX:\n\n${result.pix_payload}\n\nSeu projeto será destacado após a confirmação do pagamento.`
        );
      } else {
        Alert.alert('Sucesso', 'Destaque do projeto iniciado! Verifique o status do pagamento.');
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.detail || 'Falha ao destacar projeto.');
    } finally {
      setFeaturing(false);
    }
  };

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
                <Text style={styles.detailTitle}>{clientInfo?.full_name || project.client_name || '—'}</Text>
              </View>
            </View>

            {(clientInfo?.phone || (project as any).client_phone) && (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}><Text>📞</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>Telefone do Cliente</Text>
                  <Text style={styles.detailTitle}>{clientInfo?.phone || (project as any).client_phone}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}><Text>📍</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Local da Obra</Text>
                <Text style={styles.detailTitle}>{addressFormatted}</Text>
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

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Profissionais que entraram em contato</Text>

            {loadingContacts ? (
              <ActivityIndicator />
            ) : (
              <ProjectContactsList 
                contacts={contacts}
                onContactPress={(contactId) => {
                  navigation.navigate('ContactDetail', { contactId });
                }}
              />
            )}
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
          {project.status !== 'closed' && (
            <Button
              mode="contained"
              buttonColor="#10B981"
              textColor="#fff"
              onPress={handleOpenCloseModal}
              style={{ marginBottom: 8 }}
              icon="check-circle"
            >
              Concluir Projeto
            </Button>
          )}
          <Button
            mode="outlined"
            onPress={handleOpenFeaturedModal}
            style={{ marginBottom: 8 }}
            icon="star"
          >
            Destacar Projeto
          </Button>
          <Button
            mode="contained"
            buttonColor={colors.error}
            textColor="#fff"
            onPress={() => Alert.alert(

              'Excluir Projeto',
              'Tem certeza que deseja excluir este projeto?',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: handleDelete },
              ]
            )
            }

            style={{ marginBottom: 8 }}
          
         

          >Excluir</Button>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('EditProject' as never, { project } as never)}
          >Editar</Button>
        </View>

        {/* Close Project Modal */}
        <Modal
          visible={closeModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setCloseModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Concluir Projeto</Text>
              <Text style={styles.modalSubtitle}>
                Selecione o profissional vencedor e informe o valor final (opcional).
              </Text>
              {contacts.length > 0 ? (
                <RadioButton.Group
                  value={selectedProfessionalId ?? ''}
                  onValueChange={setSelectedProfessionalId}
                >
                  {contacts.map((c) => (
                    <View key={c.id} style={styles.radioRow}>
                      <RadioButton value={c.professional_id} color={colors.primary} />
                      <Text style={styles.radioLabel}>{c.professional_name}</Text>
                    </View>
                  ))}
                  <View style={styles.radioRow}>
                    <RadioButton value="" color={colors.primary} />
                    <Text style={styles.radioLabel}>Nenhum (sem selecionar profissional)</Text>
                  </View>
                </RadioButton.Group>
              ) : (
                <Text style={styles.noContactsText}>
                  Nenhum profissional entrou em contato ainda.
                </Text>
              )}
              <TextInput
                label="Valor final (R$)"
                value={finalValue}
                onChangeText={setFinalValue}
                keyboardType="numeric"
                mode="outlined"
                style={styles.finalValueInput}
              />
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setCloseModalVisible(false)}
                  disabled={closingProject}
                >
                  Cancelar
                </Button>
                <Button
                  mode="contained"
                  onPress={handleCloseProject}
                  loading={closingProject}
                  disabled={closingProject}
                  buttonColor="#10B981"
                >
                  Confirmar
                </Button>
              </View>
            </View>
          </View>
        </Modal>

        {/* Featured Project Modal */}
        <Modal
          visible={featuredModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setFeaturedModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>⭐ Destacar Projeto</Text>
              <Text style={styles.modalSubtitle}>
                Projetos destacados aparecem no topo das buscas dos profissionais.
              </Text>
              {featuredPricing.map((option: any) => (
                <View key={option.duration_days} style={styles.radioRow}>
                  <RadioButton
                    value={String(option.duration_days)}
                    status={selectedDuration === option.duration_days ? 'checked' : 'unchecked'}
                    onPress={() => setSelectedDuration(option.duration_days)}
                    color={colors.primary}
                  />
                  <Text style={styles.radioLabel}>
                    {option.duration_days} dias —{' '}
                    {(option.price ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Text>
                </View>
              ))}
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setFeaturedModalVisible(false)}
                  disabled={featuring}
                >
                  Cancelar
                </Button>
                <Button
                  mode="contained"
                  onPress={handleFeatureProject}
                  loading={featuring}
                  disabled={featuring || !selectedDuration}
                  buttonColor="#F59E0B"
                >
                  Pagar via PIX
                </Button>
              </View>
            </View>
          </View>
        </Modal>

        {/* Evaluation Modal after project close */}
        {project && (
          <EvaluationModal
            visible={evaluationVisible}
            onDismiss={() => setEvaluationVisible(false)}
            onSubmit={handleSubmitEvaluation}
            projectTitle={project.title}
          />
        )}
      </ScrollView>
    </View>
  );
};

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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 18 },
  radioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  radioLabel: { fontSize: 14, color: '#374151', flex: 1 },
  noContactsText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 16 },
  finalValueInput: { marginTop: 12, marginBottom: 16, backgroundColor: '#FFFFFF' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});

export default ProjectClientDetailScreen;
