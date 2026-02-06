import React, { useState, useEffect } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Button, TextInput, Surface, Title, HelperText, Checkbox, Text, Snackbar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { signUpWithEmail, loginWithEmail, completeProfile } from '../api/auth';
import { isValidCPF, onlyDigits } from '../utils/cpf';
import useAuthStore, { AuthState } from '../stores/authStore';
import { commonStyles } from '../theme/styles';

export default function SignUpScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const setToken = useAuthStore((s: AuthState) => s.setToken);
  const setUser = useAuthStore((s: AuthState) => s.setUser);
  const token = useAuthStore((s: AuthState) => s.token);
  const currentUser = useAuthStore((s: AuthState) => s.user);

  // If route param `completeProfile` is truthy, this screen behaves as "complete profile"
  const isCompleting = Boolean((route.params as any)?.completeProfile);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  // Format helpers and validators

  const [phone, setPhone] = useState('');
  const [isProfessional, setIsProfessional] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return value;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return value;
  };

  const validateForm = () => {
    if (!fullName.trim()) {
      setError('Nome completo é obrigatório');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('E-mail inválido');
      return false;
    }
    if (!cpf.trim() || !isValidCPF(cpf)) {
      setError('CPF inválido');
      return false;
    }

    // If we are completing the profile, password is optional; if provided must match and be >=6
    if (isCompleting) {
      if (password && password.length < 6) {
        setError('Senha deve ter no mínimo 6 caracteres');
        return false;
      }
      if (password !== confirmPassword) {
        setError('As senhas não coincidem');
        return false;
      }
    } else {
      if (password.length < 6) {
        setError('Senha deve ter no mínimo 6 caracteres');
        return false;
      }
      if (password !== confirmPassword) {
        setError('As senhas não coincidem');
        return false;
      }
    }

    return true;
  };

  const onSignUp = async () => {
    if (!validateForm()) return;

    // If completing profile, require token and call completeProfile
    if (isCompleting) {
      if (!token) {
        Alert.alert('Autenticação requerida', 'Você precisa estar logado para completar o perfil.');
        navigation.navigate('Login' as never);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const roles = isProfessional ? ['client', 'professional'] : ['client'];

        const payload: any = {
          full_name: fullName.trim(),
          cpf: cpf.replace(/\D/g, ''),
          phone: phone ? phone.replace(/\D/g, '') : undefined,
          roles,
        };
        if (password) payload.password = password;

        const updatedUser = await completeProfile(token, payload);
        setUser(updatedUser);

        // Show success snackbar then navigate (so user sees feedback)
        setSnackbarMsg('Perfil atualizado com sucesso');
        setSnackbarVisible(true);
        const isClient = updatedUser.roles?.includes('client');
        const isProfessionalRole = updatedUser.roles?.includes('professional');
        setTimeout(() => {
          if (isClient && !isProfessionalRole) {
            navigation.replace('WelcomeCustomer' as never);
          } else if (isProfessionalRole && !isClient) {
            navigation.replace('WelcomeProfessional' as never);
          } else {
            navigation.replace('WelcomeCustomer' as never);
          }
        }, 800);
      } catch (e: any) {
        setError(e.message || 'Erro ao completar perfil');
      } finally {
        setLoading(false);
      }

      return;
    }

    // Regular signup flow
    setLoading(true);
    setError(null);
    try {
      const roles = isProfessional ? ['client', 'professional'] : ['client'];

      const user = await signUpWithEmail({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        cpf: cpf.replace(/\D/g, ''),
        phone: phone ? phone.replace(/\D/g, '') : undefined,
        roles,
      });

      // Após cadastro, fazer login automaticamente
      const loginData = await loginWithEmail(email, password);
      await setToken(loginData.token);
      setUser(loginData.user);

      navigation.navigate('Login');
    } catch (e: any) {
      setError(e.message || 'Erro no cadastro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCompleting && currentUser) {
      setFullName(currentUser.full_name || '');
      setCpf(currentUser?.cpf || '000.000.000-00');
      setPhone(currentUser.phone || '');
      setEmail(currentUser.email || '');
      setIsProfessional(currentUser.roles?.includes('professional') || false);
    }
  }, [isCompleting, currentUser]);

  return (
    <KeyboardAvoidingView
      style={commonStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={commonStyles.scrollContainer}>
        <Surface style={commonStyles.surface}>
          <Title style={commonStyles.title}>{isCompleting ? 'Completar Perfil' : 'Criar conta'}</Title>

          <TextInput
            label="Nome completo"
            value={fullName}
            onChangeText={setFullName}
            style={commonStyles.input}
            autoCapitalize="words"
          />

          <TextInput
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={commonStyles.input}
            editable={!isCompleting}
          />

          <TextInput
            label="CPF"
            value={cpf}
            onChangeText={(text) => setCpf(formatCPF(text))}
            keyboardType="numeric"
            style={commonStyles.input}
            maxLength={14}
            editable={true} // Sempre editável por enquanto
          />
          <HelperText type="info">Digite seu CPF completo (apenas números)</HelperText>

          <TextInput
            label="Telefone (opcional)"
            value={phone}
            onChangeText={(text) => setPhone(formatPhone(text))}
            keyboardType="phone-pad"
            style={commonStyles.input}
            maxLength={15}
          />

          <TextInput
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            style={commonStyles.input}
            right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(!showPassword)} />}
          />
          {isCompleting && <HelperText type="info">Deixe em branco para manter sua senha atual</HelperText>}

          <TextInput
            label="Confirmar senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            style={commonStyles.input}
            right={<TextInput.Icon icon={showConfirmPassword ? 'eye-off' : 'eye'} onPress={() => setShowConfirmPassword(!showConfirmPassword)} />}
          />

          <Checkbox.Item
            label="Quero me cadastrar como profissional"
            status={isProfessional ? 'checked' : 'unchecked'}
            onPress={() => setIsProfessional(!isProfessional)}
          />

          {error ? <HelperText type="error">{error}</HelperText> : null}

          <Button mode="contained" onPress={onSignUp} loading={loading} disabled={loading} style={commonStyles.button}>
            {isCompleting ? 'Salvar Perfil' : 'Criar conta'}
          </Button>

          <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={1500}>
            {snackbarMsg}
          </Snackbar>

          {!isCompleting && (
            <Button onPress={() => navigation.navigate('Login')} compact>
              Já tenho conta
            </Button>
          )}
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
