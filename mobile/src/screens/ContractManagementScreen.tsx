import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  ActivityIndicator,
  Portal,
  Dialog,
  RadioButton,
  Divider,
  Chip,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import {
  apiService,
  ContractTemplate,
  GeneratedContract,
  Document,
} from '../services/api';

type ContractManagementScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ContractManagement'
>;
type ContractManagementScreenRouteProp = RouteProp<
  RootStackParamList,
  'ContractManagement'
>;

interface ContractManagementScreenProps {
  navigation: ContractManagementScreenNavigationProp;
  route: ContractManagementScreenRouteProp;
}

export default function ContractManagementScreen({
  navigation,
  route,
}: ContractManagementScreenProps): React.JSX.Element {
  const { projectId, professionalId } = route.params;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [generatedContract, setGeneratedContract] = useState<GeneratedContract | null>(null);

  // Dialogs
  const [showTemplateDialog, setShowTemplateDialog] = useState<boolean>(false);
  const [showContractDialog, setShowContractDialog] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      // Load templates and documents in parallel
      const [templatesData, documentsData] = await Promise.all([
        apiService.getContractTemplates(token),
        apiService.getProjectDocuments(token, projectId),
      ]);

      setTemplates(templatesData);
      setDocuments(documentsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateContract = async (): Promise<void> => {
    if (!selectedTemplateId) {
      Alert.alert('Atenção', 'Selecione um template de contrato');
      return;
    }

    setIsGenerating(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const contract = await apiService.generateContractForProject(
        token,
        projectId,
        selectedTemplateId,
        professionalId
      );

      setGeneratedContract(contract);
      setShowTemplateDialog(false);
      setShowContractDialog(true);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Erro ao gerar contrato';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareContract = async (): Promise<void> => {
    if (!generatedContract) return;

    try {
      await Share.share({
        message: generatedContract.contract_text,
        title: generatedContract.template_title,
      });
    } catch (error) {
      console.error('Error sharing contract:', error);
    }
  };

  const handleSaveContract = async (): Promise<void> => {
    if (!generatedContract) return;

    try {
      // Save contract as text file
      const filename = `${generatedContract.template_title.replace(/\s+/g, '_')}.txt`;
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, generatedContract.contract_text);

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert(
          'Sucesso',
          'Contrato salvo em: ' + fileUri
        );
      }
    } catch (error) {
      console.error('Error saving contract:', error);
      Alert.alert('Erro', 'Não foi possível salvar o contrato');
    }
  };

  const handleUploadSignedDocument = async (): Promise<void> => {
    try {
      // Pick a PDF document
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setIsUploading(true);

      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const file = result.assets[0];

      // Create a File object from the picked document
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const fileObject = new File([blob], file.name, { type: 'application/pdf' });

      // Upload the document
      const uploadedDoc = await apiService.uploadDocument(token, projectId, fileObject);

      Alert.alert(
        'Sucesso',
        'Documento enviado com sucesso! A validação da assinatura está em andamento.'
      );

      // Reload documents
      await loadData();
      setShowContractDialog(false);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Erro ao enviar documento';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const getValidationStatusColor = (status: string): string => {
    switch (status) {
      case 'valid':
        return '#4caf50';
      case 'invalid':
        return '#f44336';
      case 'pending':
        return '#ff9800';
      case 'error':
        return '#9e9e9e';
      default:
        return '#9e9e9e';
    }
  };

  const getValidationStatusLabel = (status: string): string => {
    switch (status) {
      case 'valid':
        return 'Válido';
      case 'invalid':
        return 'Inválido';
      case 'pending':
        return 'Pendente';
      case 'error':
        return 'Erro';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3471b9" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Button
            mode="text"
            onPress={() => navigation.goBack()}
            icon="arrow-left"
            textColor="#3471b9"
          >
            Voltar
          </Button>
        </View>

        <Text style={styles.title}>Contratos</Text>
        <Text style={styles.subtitle}>
          Gere e gerencie contratos para este projeto
        </Text>

        {/* Generate Contract Button */}
        <Button
          mode="contained"
          onPress={() => setShowTemplateDialog(true)}
          style={styles.generateButton}
          icon="file-document-edit"
        >
          Gerar Novo Contrato
        </Button>

        {/* Documents List */}
        <Text style={styles.sectionTitle}>Documentos Enviados</Text>

        {documents.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>
                Nenhum documento enviado ainda
              </Text>
            </Card.Content>
          </Card>
        ) : (
          documents.map((doc) => (
            <Card key={doc._id} style={styles.documentCard}>
              <Card.Content>
                <View style={styles.documentHeader}>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName}>
                      {doc.original_filename}
                    </Text>
                    <Text style={styles.documentDate}>
                      Enviado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                  <Chip
                    style={[
                      styles.statusChip,
                      { backgroundColor: getValidationStatusColor(doc.validation_status) + '20' },
                    ]}
                    textStyle={{ color: getValidationStatusColor(doc.validation_status) }}
                  >
                    {getValidationStatusLabel(doc.validation_status)}
                  </Chip>
                </View>

                {doc.validation_result?.assinaturas && doc.validation_result.assinaturas.length > 0 && (
                  <View style={styles.signaturesSection}>
                    <Text style={styles.signaturesTitle}>
                      Assinaturas ({doc.validation_result.total_assinaturas}):
                    </Text>
                    {doc.validation_result.assinaturas.map((assinatura: any, index: number) => (
                      <View key={index} style={styles.signatureItem}>
                        <Text style={styles.signatureName}>
                          • {assinatura.assinado_por}
                        </Text>
                        {assinatura.cpf && (
                          <Text style={styles.signatureCpf}>
                            CPF: {assinatura.cpf}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {doc.validation_status === 'error' && doc.validation_result?.error && (
                  <Text style={styles.errorText}>
                    Erro: {doc.validation_result.error}
                  </Text>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Template Selection Dialog */}
      <Portal>
        <Dialog
          visible={showTemplateDialog}
          onDismiss={() => setShowTemplateDialog(false)}
        >
          <Dialog.Title>Selecionar Template</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogContent}>
              <RadioButton.Group
                onValueChange={(value) => setSelectedTemplateId(value)}
                value={selectedTemplateId}
              >
                {templates.map((template) => (
                  <View key={template._id} style={styles.templateItem}>
                    <RadioButton.Item
                      label={template.title}
                      value={template._id}
                      labelStyle={styles.templateLabel}
                    />
                    {template.description && (
                      <Text style={styles.templateDescription}>
                        {template.description}
                      </Text>
                    )}
                    <Divider style={styles.templateDivider} />
                  </View>
                ))}
              </RadioButton.Group>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowTemplateDialog(false)}>Cancelar</Button>
            <Button
              onPress={handleGenerateContract}
              loading={isGenerating}
              disabled={isGenerating || !selectedTemplateId}
            >
              Gerar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Generated Contract Dialog */}
      <Portal>
        <Dialog
          visible={showContractDialog}
          onDismiss={() => setShowContractDialog(false)}
          style={styles.contractDialog}
        >
          <Dialog.Title>{generatedContract?.template_title}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.contractContent}>
              <Text style={styles.contractText}>
                {generatedContract?.contract_text}
              </Text>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={handleShareContract} icon="share-variant">
              Compartilhar
            </Button>
            <Button onPress={handleSaveContract} icon="download">
              Baixar
            </Button>
            <Button
              onPress={handleUploadSignedDocument}
              icon="upload"
              loading={isUploading}
              disabled={isUploading}
            >
              Enviar Assinado
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  generateButton: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  documentCard: {
    backgroundColor: '#fff',
    marginBottom: 12,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  documentInfo: {
    flex: 1,
    marginRight: 12,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 13,
    color: '#666',
  },
  statusChip: {
    height: 28,
  },
  signaturesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  signaturesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  signatureItem: {
    marginBottom: 8,
  },
  signatureName: {
    fontSize: 14,
    color: '#333',
  },
  signatureCpf: {
    fontSize: 12,
    color: '#666',
    marginLeft: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#f44336',
    marginTop: 8,
  },
  dialogContent: {
    paddingHorizontal: 0,
  },
  templateItem: {
    marginBottom: 8,
  },
  templateLabel: {
    fontSize: 16,
  },
  templateDescription: {
    fontSize: 13,
    color: '#666',
    marginLeft: 56,
    marginTop: -8,
    marginBottom: 8,
  },
  templateDivider: {
    marginTop: 8,
  },
  contractDialog: {
    maxHeight: '80%',
  },
  contractContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  contractText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
});
