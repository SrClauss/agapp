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
  Checkbox,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

type SignUpScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignUp'>;

interface SignUpScreenProps {
  navigation: SignUpScreenNavigationProp;
}

export default function SignUpScreen({ navigation }: SignUpScreenProps): React.JSX.Element {
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [cpf, setCpf] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const formatCPF = (text: string): string => {
    // Remove non-digits
    const cleaned = text.replace(/\D/g, '');
    // Format as XXX.XXX.XXX-XX
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return cleaned.slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const formatPhone = (text: string): string => {
    // Remove non-digits
    const cleaned = text.replace(/\D/g, '');
    // Format as (XX) XXXXX-XXXX or (XX) XXXX-XXXX
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return cleaned.slice(0, 11)
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateCPF = (cpf: string): boolean => {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.length === 11;
  };

  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 0 || cleaned.length === 11;
  };

  const handleSignUp = async (): Promise<void> => {
    // Validations
    if (!fullName.trim()) {
      Alert.alert('Erro', 'Por favor, informe seu nome completo');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Erro', 'Por favor, informe um email válido');
      return;
    }

    if (!validateCPF(cpf)) {
      Alert.alert('Erro', 'Por favor, informe um CPF válido (11 dígitos)');
      return;
    }

    if (!validatePhone(phone)) {
      Alert.alert('Erro', 'Por favor, informe um telefone válido (11 dígitos) ou deixe em branco');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não conferem');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Erro', 'Você precisa aceitar os termos de uso');
      return;
    }

    setIsLoading(true);

    try {
      // Remove formatting from CPF and phone
      const cleanCpf = cpf.replace(/\D/g, '');
      const cleanPhone = phone ? phone.replace(/\D/g, '') : undefined;

      const userData = {
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        cpf: cleanCpf,
        phone: cleanPhone,
        password,
        roles: ['client'], // Default role
      };

      const user = await apiService.register(userData);

      // Auto login after successful registration
      try {
        const loginResponse = await apiService.login({
          username: email.toLowerCase().trim(),
          password,
        });

        // Store tokens
        await AsyncStorage.setItem('access_token', loginResponse.access_token);
        if (loginResponse.refresh_token) {
          await AsyncStorage.setItem('refresh_token', loginResponse.refresh_token);
        }

        // Store initial role from registration
        await AsyncStorage.setItem('user_roles', JSON.stringify(userData.roles));

        // Navigate to role selection
        navigation.replace('RoleSelection');
      } catch (loginError) {
        // If auto-login fails, just go to login screen
        Alert.alert(
          'Sucesso!',
          'Sua conta foi criada com sucesso. Faça login para continuar.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar conta. Tente novamente.';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = (): void => {
    // TODO: Implementar cadastro com Google
    console.log('Google SignUp');
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableRipple
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Voltar</Text>
            </TouchableRipple>
          </View>

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
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Preencha seus dados para começar</Text>

            <TextInput
              label="Nome completo"
              value={fullName}
              onChangeText={setFullName}
              mode="outlined"
              autoCapitalize="words"
              style={styles.input}
              outlineColor="#e0e0e0"
              activeOutlineColor="#3471b9"
              left={<TextInput.Icon icon="account" />}
              disabled={isLoading}
            />

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
              label="CPF"
              value={cpf}
              onChangeText={(text) => setCpf(formatCPF(text))}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              outlineColor="#e0e0e0"
              activeOutlineColor="#3471b9"
              left={<TextInput.Icon icon="card-account-details" />}
              placeholder="000.000.000-00"
              maxLength={14}
              disabled={isLoading}
            />

            <TextInput
              label="Telefone (opcional)"
              value={phone}
              onChangeText={(text) => setPhone(formatPhone(text))}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              outlineColor="#e0e0e0"
              activeOutlineColor="#3471b9"
              left={<TextInput.Icon icon="phone" />}
              placeholder="(00) 00000-0000"
              maxLength={15}
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

            <TextInput
              label="Confirmar senha"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry={!showConfirmPassword}
              style={styles.input}
              outlineColor="#e0e0e0"
              activeOutlineColor="#3471b9"
              left={<TextInput.Icon icon="lock-check" />}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
              disabled={isLoading}
            />

            {/* Terms Checkbox */}
            <View style={styles.termsContainer}>
              <Checkbox
                status={acceptedTerms ? 'checked' : 'unchecked'}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                color="#3471b9"
              />
              <View style={styles.termsTextContainer}>
                <Text style={styles.termsText}>Eu aceito os </Text>
                <TouchableRipple
                  onPress={() => console.log('Ver termos')}
                  style={styles.termsLink}
                >
                  <Text style={styles.termsLinkText}>Termos de Uso</Text>
                </TouchableRipple>
                <Text style={styles.termsText}> e </Text>
                <TouchableRipple
                  onPress={() => console.log('Ver política')}
                  style={styles.termsLink}
                >
                  <Text style={styles.termsLinkText}>Política de Privacidade</Text>
                </TouchableRipple>
              </View>
            </View>

            <Button
              mode="contained"
              onPress={handleSignUp}
              style={styles.signUpButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              disabled={!acceptedTerms || isLoading}
              loading={isLoading}
            >
              {isLoading ? 'Criando conta...' : 'Criar conta'}
            </Button>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <Divider style={styles.divider} />
              <Text style={styles.dividerText}>ou</Text>
              <Divider style={styles.divider} />
            </View>

            {/* Google Sign Up Button */}
            <Button
              mode="outlined"
              onPress={handleGoogleSignUp}
              style={styles.googleButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.googleButtonLabel}
              icon="google"
            >
              Continuar com Google
            </Button>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Já tem uma conta? </Text>
              <TouchableRipple
                onPress={() => navigation.navigate('Login')}
                style={styles.loginLink}
              >
                <Text style={styles.loginLinkText}>Entrar</Text>
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
  header: {
    marginBottom: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#3471b9',
    fontSize: 16,
    fontWeight: '500',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3471b9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3471b9',
  },
  tagline: {
    fontSize: 14,
    color: '#666',
  },
  logoImage: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 16,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  termsTextContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginLeft: 8,
    marginTop: 8,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
  },
  termsLink: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  termsLinkText: {
    fontSize: 14,
    color: '#3471b9',
    fontWeight: '500',
  },
  signUpButton: {
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  loginLinkText: {
    color: '#3471b9',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
