import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Divider,
  TouchableRipple,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: LoginScreenProps): React.JSX.Element {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async (): Promise<void> => {
    // Validations
    if (!validateEmail(email)) {
      Alert.alert('Erro', 'Por favor, informe um email válido');
      return;
    }

    if (!password) {
      Alert.alert('Erro', 'Por favor, informe sua senha');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiService.login({
        username: email.toLowerCase().trim(),
        password,
      });

      // Store tokens
      await AsyncStorage.setItem('access_token', response.access_token);
      if (response.refresh_token) {
        await AsyncStorage.setItem('refresh_token', response.refresh_token);
      }

      // Navigate to Home
      navigation.replace('Home');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login. Verifique suas credenciais.';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = (): void => {
    // TODO: Implementar login com Google
    console.log('Google Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/adaptive-icon.png')}
              style={styles.logoImage}
            />
            <Text style={styles.appName}>Agilizapp</Text>
            <Text style={styles.tagline}>Conexões que Movem</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>Bem-vindo de volta</Text>
            <Text style={styles.subtitle}>Entre com sua conta</Text>

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              outlineColor="#e0e0e0"
              activeOutlineColor="#3471b9"
              left={<TextInput.Icon icon="email" />}
              disabled={isLoading}
            />

            <TextInput
              label="Senha"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              outlineColor="#e0e0e0"
              activeOutlineColor="#3471b9"
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              disabled={isLoading}
            />

            <TouchableRipple
              onPress={() => console.log('Esqueceu senha')}
              style={styles.forgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
            </TouchableRipple>

            <Button
              mode="contained"
              onPress={handleLogin}
              style={styles.loginButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              disabled={isLoading}
              loading={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <Divider style={styles.divider} />
              <Text style={styles.dividerText}>ou</Text>
              <Divider style={styles.divider} />
            </View>

            {/* Google Login Button */}
            <Button
              mode="outlined"
              onPress={handleGoogleLogin}
              style={styles.googleButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.googleButtonLabel}
              icon="google"
            >
              Continuar com Google
            </Button>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Não tem uma conta? </Text>
              <TouchableRipple
                onPress={() => navigation.navigate('SignUp')}
                style={styles.signUpLink}
              >
                <Text style={styles.signUpLinkText}>Cadastre-se</Text>
              </TouchableRipple>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  logoImage: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3471b9',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  forgotPasswordText: {
    color: '#3471b9',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    borderRadius: 8,
    elevation: 2,
    backgroundColor: '#3471b9',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  googleButton: {
    borderRadius: 8,
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  googleButtonLabel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  signUpText: {
    color: '#666',
    fontSize: 14,
  },
  signUpLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  signUpLinkText: {
    color: '#3471b9',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
