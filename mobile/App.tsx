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
import ProjectDetailScreen from './src/screens/ProjectDetailScreen';
import ProjectSummaryScreen from './src/screens/ProjectSummaryScreen';
import CompleteProfileScreen from './src/screens/CompleteProfileScreen';
import ProfileSelectionScreen from './src/screens/ProfileSelectionScreen';
import AdScreen from './src/screens/AdScreen';
import ProfessionalHomeScreen from './src/screens/ProfessionalHomeScreen';
import { theme } from './src/theme';
import { useAuthStore } from './src/stores/authStore';
import { fetchCurrentUser } from './src/api/auth';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<string>('Login');
  const { token, setUser, isHydrated } = useAuthStore();

  console.log(`[App] Componente App renderizado. isHydrated: ${isHydrated}, token: ${!!token}`);

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
          } else if (!currentUser.roles || currentUser.roles.length === 0) {
            setInitialRoute('ProfileSelection');
          } else {
            setInitialRoute('WelcomeCustomer');
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

  useEffect(() => {
    async function initializeApp() {
      console.log(`[App] Inicializando app...`);

      // Aguardar hidratação do store
      if (isHydrated) {
        console.log(`[App] Store hidratado, executando checkAuth`);
        checkAuth();
      } else {
        console.log(`[App] Aguardando hidratação do store...`);
      }
    }

    initializeApp();
  }, [isHydrated, token]);

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
          <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ProjectSummary" component={ProjectSummaryScreen} options={{ title: 'Resumo do Projeto' }} />
          <Stack.Screen name="ProfessionalHome" component={ProfessionalHomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} options={{ title: 'Completar Perfil' }} />
          <Stack.Screen name="ProfileSelection" component={ProfileSelectionScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </PaperProvider>
  );
}
