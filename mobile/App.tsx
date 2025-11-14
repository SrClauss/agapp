
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
import CreateProjectScreen from './src/screens/CreateProjectScreen';
import AddressSearchScreen from './src/screens/AddressSearchScreen';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Home: undefined;
  RoleSelection: undefined;
  RoleChoice: undefined;
  ClientDashboard: undefined;
  CreateProject: undefined;
  AddressSearch: { onSelect: (address: string) => void };
};

const Stack = createStackNavigator<RootStackParamList>();

const screenOptions: StackNavigationOptions = {
  headerShown: false,
};

const theme = {
  colors: {
    primary: '#3471b9',
    accent: '#5a8fd9',
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#333333',
    error: '#d32f2f',
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
          // Check if user has client role and redirect to dashboard
          const activeRole = await AsyncStorage.getItem('active_role');
          if (activeRole === 'client') {
            setInitialRoute('ClientDashboard');
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
      <PaperProvider theme={theme}>
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
            <Stack.Screen name="CreateProject" component={CreateProjectScreen} />
            <Stack.Screen name="AddressSearch" component={AddressSearchScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
