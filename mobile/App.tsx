import React, { useEffect, useState } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import WelcomeCustomerScreen from './src/screens/WelcomeCustomerScreen';
import SearchResultsScreen from './src/screens/SearchResultsScreen';
import CreateProjectScreen from './src/screens/CreateProjectScreen';
import ProjectClientDetailScreen from './src/screens/ProjectClientDetailScreen';
import ProjectProfessionalsDetailScreen from './src/screens/ProjectProfessionalsDetailScreen';
import AllProjectsScreen from './src/screens/AllProjectsScreen';
import CompleteProfileScreen from './src/screens/CompleteProfileScreen';
import ProfileSelectionScreen from './src/screens/ProfileSelectionScreen';
import AdScreen from './src/screens/AdScreen';
import WelcomeProfessionalScreen from './src/screens/WelcomeProfessionalScreen';
import ProjectsListScreen from './src/screens/ProjectsListScreen';
import ContactDetailScreen from './src/screens/ContactDetailScreen';
import ProfileEvaluationsScreen from './src/screens/ProfileEvaluationsScreen';
import CreditsScreen from './src/screens/CreditsScreen';
import CreditPackagesScreen from './src/screens/CreditPackagesScreen';
import SubscriptionsScreen from './src/screens/SubscriptionsScreen';
import SupportScreen from './src/screens/SupportScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import { theme } from './src/theme';
import { useAuthStore } from './src/stores/authStore';
import useChatStore from './src/stores/chatStore';
import useNotificationStore from './src/stores/notificationStore';
import { getRouteForRoles } from './src/utils/roles';
import { fetchCurrentUser } from './src/api/auth';
import { ChatModal } from './src/components/ChatModal';
import { 
  registerForPushNotificationsAsync, 
  registerPushTokenOnServer,
  setupNotificationResponseListener,
  setupNotificationReceivedListener,
} from './src/services/notifications';
import client from './src/api/axiosClient';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<string>('Login');
  const { token, setUser, isHydrated, activeRole } = useAuthStore();
  const { isChatOpen, activeContactId, closeChat } = useChatStore();
  const { setCount: setUnreadCount } = useNotificationStore();

  const checkAuth = async () => {
    try {
      console.log(`[App] Verificando autenticação. Token presente: ${!!token}, isHydrated: ${isHydrated}`);
      if (token) {
        console.log(`[App] Token encontrado, verificando validade...`);
        // Verificar se o token ainda é válido
        try {
          const currentUser = await fetchCurrentUser(token);
          console.log(`[App] Token válido, usuário obtido:`, currentUser.email);
          setUser(currentUser);

          // Determinar rota inicial baseada no estado do usuário
          if (!currentUser.is_profile_complete) {
            setInitialRoute('CompleteProfile');
          } else {
            // Usa helper para garantir comportamento consistente entre telas
            const route = getRouteForRoles(currentUser.roles, activeRole);
            setInitialRoute(route);
          }
        } catch (error) {
          console.log(`[App] Token inválido, fazendo logout:`, error);
          // Token inválido ou expirado
          useAuthStore.getState().logout();
          setInitialRoute('Login');
        }
      } else {
        console.log(`[App] Nenhum token encontrado, indo para login`);
        setInitialRoute('Login');
      }
    } catch (error) {
      console.error('[App] Erro ao verificar autenticação:', error);
      setInitialRoute('Login');
    } finally {
      setIsLoading(false);
    }
  };

  // Setup push notifications
  useEffect(() => {
    let responseListener: any;
    let receivedListener: any;

    const setupNotifications = async () => {
      if (token) {
        try {
          // Register for push notifications
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            await registerPushTokenOnServer(pushToken);
            console.log('[App] Push notifications registered');
          }

          // Setup notification listeners
          responseListener = setupNotificationResponseListener();
          receivedListener = setupNotificationReceivedListener();
        } catch (error) {
          console.error('[App] Error setting up notifications:', error);
        }
      }
    };

    setupNotifications();

    return () => {
      if (responseListener) {
        responseListener.remove();
      }
      if (receivedListener) {
        receivedListener.remove();
      }
    };
  }, [token]);

  // Poll for unread message count every 60 seconds when logged in
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const fetchUnreadCount = async () => {
      try {
        const userType = activeRole === 'professional' ? 'professional' : 'client';
        const response = await client.get('/contacts/history', { params: { user_type: userType } });
        const contacts: any[] = response.data || [];
        const total = contacts.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0);
        if (!cancelled) setUnreadCount(total);
      } catch (e) {
        // ignore silently
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, activeRole]);

  useEffect(() => {
    async function initializeApp() {
      console.log(`[App] Inicializando app...`);

      // Aguardar hidratação do store
      if (isHydrated) {
        // Em dev: logue o conteúdo persistido parcialmente (mas não exponha token inteiro)
        if (__DEV__) {
          // debugCheckPersisted foi adicionado em authStore para ajudar a diagnosticar
          // situações em que o token não é re-hidratado corretamente.
          try {
            await useAuthStore.getState().debugCheckPersisted?.();
          } catch (e) {
            console.log('[App][debug] Erro ao checar estado persistido:', e);
          }
        }
        console.log(`[App] Store hidratado, executando checkAuth`);
        checkAuth();
      } else {
        console.log(`[App] Aguardando hidratação do store...`);
      }
    }

    initializeApp();
  }, [isHydrated]); // Remover 'token' das dependências para evitar checkAuth a cada mudança de token

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Criar Conta' }} />
          <Stack.Screen name="AdScreen" component={AdScreen} options={{ headerShown: false }} />
          <Stack.Screen name="WelcomeCustomer" component={WelcomeCustomerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SearchResults" component={SearchResultsScreen} options={{ title: 'Resultados' }} />
          <Stack.Screen name="CreateProject" component={CreateProjectScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EditProject" component={require('./src/screens/EditProjectScreen').default} options={{ headerShown: false }} />
          <Stack.Screen name="ProjectDetail" component={ProjectClientDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ProjectProfessionalsDetail" component={ProjectProfessionalsDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AllProjects" component={AllProjectsScreen} options={{ title: 'Todos os Projetos' }} />
          <Stack.Screen name="WelcomeProfessional" component={WelcomeProfessionalScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EditProfessionalSettings" component={require('./src/screens/EditProfessionalSettingsScreen').default} options={{ title: 'Minhas Especialidades' }} />
          <Stack.Screen name="ContactedProjects" component={require('./src/screens/ContactedProjectsScreen').default} options={{ title: 'Projetos Contatados' }} />
          <Stack.Screen name="ProjectsList" component={ProjectsListScreen} options={{ title: 'Projetos' }} />
          <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} options={{ title: 'Completar Perfil' }} />
          <Stack.Screen name="ProfileSelection" component={ProfileSelectionScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ContactDetail" component={ContactDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ProfileEvaluations" component={ProfileEvaluationsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Credits" component={CreditsScreen} options={{ title: 'Meus Créditos' }} />
          <Stack.Screen name="CreditPackages" component={CreditPackagesScreen} options={{ title: 'Comprar Créditos' }} />
          <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} options={{ title: 'Assinaturas' }} />
          <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Suporte' }} />
          <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Conversas' }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
      
      {/* Global Chat Modal */}
      {isChatOpen && activeContactId && (
        <ChatModal
          visible={isChatOpen}
          onClose={closeChat}
          contactId={activeContactId}
        />
      )}
    </PaperProvider>
  );
}
 