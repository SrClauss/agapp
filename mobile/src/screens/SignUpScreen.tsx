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
import TurnstileModal from '../components/TurnstileModal';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

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
  const [showTurnstile, setShowTurnstile] = useState<boolean>(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

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
    // Format as (XX) XXXXX-XXXX for 11 digits or (XX) XXXX-XXXX for 10 digits
    if (cleaned.length <= 11) {
      if (cleaned.length === 11) {
        // 11 digits: (XX) XXXXX-XXXX
        return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      } else if (cleaned.length === 10) {
        // 10 digits: (XX) XXXX-XXXX
        return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
      } else {
        // Partial input
        return cleaned
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      }
    }
    return cleaned.slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
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

    // Mostrar modal do Turnstile
    setShowTurnstile(true);
  };

  const handleTurnstileSuccess = async (token: string): Promise<void> => {
    setTurnstileToken(token);
    setShowTurnstile(false);
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
        turnstile_token: token,
      };

      const user = await apiService.register(userData);

      // Auto login after successful registration
      try {
        const loginResponse = await apiService.login({
          username: email.toLowerCase().trim(),
          password,
          turnstile_token: token,
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
      setTurnstileToken(null);
    }
  };

  const handleTurnstileCancel = (): void => {
    setShowTurnstile(false);
    setTurnstileToken(null);
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
                <Text style={styles.termsText}>Eu aceito  </Text>
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

      {/* Turnstile Modal */}
      <TurnstileModal
        visible={showTurnstile}
        onSuccess={handleTurnstileSuccess}
        onCancel={handleTurnstileCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  header: {
    marginBottom: spacing.base,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.base,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  logoText: {
    fontSize: typography.fontSize['5xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  appName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  tagline: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  logoImage: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: spacing.base,
  },
  formContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  input: {
    marginBottom: spacing.base,
    backgroundColor: colors.white,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  termsTextContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginLeft: spacing.sm,
    marginTop: spacing.sm,
  },
  termsText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  termsLink: {
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: 2,
  },
  termsLinkText: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  signUpButton: {
    borderRadius: borderRadius.base,
    ...shadows.base,
    backgroundColor: colors.primary,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: spacing.base,
    color: colors.textDisabled,
    fontSize: typography.fontSize.base,
  },
  googleButton: {
    borderRadius: borderRadius.base,
    borderColor: colors.gray300,
    borderWidth: 1,
  },
  googleButtonLabel: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  loginText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
  },
  loginLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  loginLinkText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
