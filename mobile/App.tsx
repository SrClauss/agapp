
import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, StackNavigationOptions } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import HomeScreen from './src/screens/HomeScreen';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';
import RoleChoiceScreen from './src/screens/RoleChoiceScreen';
import ClientDashboardScreen from './src/screens/ClientDashboardScreen';
import ProfessionalDashboardScreen from './src/screens/ProfessionalDashboardScreen';
import CreateProjectScreen from './src/screens/CreateProjectScreen';
import AddressSearchScreen from './src/screens/AddressSearchScreen';
import ProjectDetailsScreen from './src/screens/ProjectDetailsScreen';
import ProfileSettingsScreen from './src/screens/ProfileSettingsScreen';
import ContractManagementScreen from './src/screens/ContractManagementScreen';
import BuyCreditsScreen from './src/screens/BuyCreditsScreen';
import PaymentWebViewScreen from './src/screens/PaymentWebViewScreen';
import SupportScreen from './src/screens/SupportScreen';
import CreateTicketScreen from './src/screens/CreateTicketScreen';
import TicketDetailsScreen from './src/screens/TicketDetailsScreen';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { SnackbarProvider } from './src/hooks/useSnackbar';
import { colors } from './src/theme';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Home: undefined;
  RoleSelection: undefined;
  RoleChoice: undefined;
  ClientDashboard: undefined;
  ProfessionalDashboard: undefined;
  CreateProject: undefined;
  AddressSearch: { onSelect: (address: string) => void };
  ProjectDetails: { projectId: string };
  ProfileSettings: undefined;
  ContractManagement: { projectId: string; professionalId: string };
  BuyCredits: undefined;
  PaymentWebView: { paymentUrl: string; paymentId: string; onSuccess?: () => void };
  Support: undefined;
  CreateTicket: { projectId?: string; paymentId?: string };
  TicketDetails: { ticketId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

const screenOptions: StackNavigationOptions = {
  headerShown: false,
};

const paperTheme = {
  colors: {
    primary: colors.primary,
    accent: colors.primaryLight,
    background: colors.background,
    surface: colors.surface,
    text: colors.textPrimary,
    error: colors.error,
  },
};

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App(): React.JSX.Element {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Login');
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    const checkAuthStatus = async (): Promise<void> => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (token) {
          // Check if user has role and redirect to appropriate dashboard
          const activeRole = await AsyncStorage.getItem('active_role');
          if (activeRole === 'client') {
            setInitialRoute('ClientDashboard');
          } else if (activeRole === 'professional') {
            setInitialRoute('ProfessionalDashboard');
          } else {
            setInitialRoute('Home');
          }
        } else {
          setInitialRoute('Login');
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setInitialRoute('Login');
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    };

    checkAuthStatus();
  }, []);

  if (!isReady) {
    return null; // or a loading component
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <SnackbarProvider>
          <NotificationProvider>
            <NavigationContainer>
              <Stack.Navigator
                initialRouteName={initialRoute}
                screenOptions={screenOptions}
                id={"root-stack" as any}
              >
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="SignUp" component={SignUpScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
                <Stack.Screen name="RoleChoice" component={RoleChoiceScreen} />
                <Stack.Screen name="ClientDashboard" component={ClientDashboardScreen} />
                <Stack.Screen name="ProfessionalDashboard" component={ProfessionalDashboardScreen} />
                <Stack.Screen name="CreateProject" component={CreateProjectScreen} />
                <Stack.Screen name="AddressSearch" component={AddressSearchScreen} />
                <Stack.Screen name="ProjectDetails" component={ProjectDetailsScreen} />
                <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
                <Stack.Screen name="ContractManagement" component={ContractManagementScreen} />
                <Stack.Screen name="BuyCredits" component={BuyCreditsScreen} />
                <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} />
                <Stack.Screen name="Support" component={SupportScreen} />
                <Stack.Screen name="CreateTicket" component={CreateTicketScreen} />
                <Stack.Screen name="TicketDetails" component={TicketDetailsScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </NotificationProvider>
        </SnackbarProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
