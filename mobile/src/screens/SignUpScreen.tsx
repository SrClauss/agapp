import React, { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, TextInput, Surface, Title, HelperText, Checkbox, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { signUpWithEmail, loginWithEmail } from '../api/auth';
import useAuthStore, { AuthState } from '../stores/authStore';
import { commonStyles } from '../theme/styles';

export default function SignUpScreen() {
  const navigation = useNavigation();
  const setToken = useAuthStore((s: AuthState) => s.setToken);
  const setUser = useAuthStore((s: AuthState) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [isProfessional, setIsProfessional] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (!cpf.trim() || cpf.replace(/\D/g, '').length !== 11) {
      setError('CPF inválido');
      return false;
    }
    if (password.length < 6) {
      setError('Senha deve ter no mínimo 6 caracteres');
      return false;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return false;
    }
    return true;
  };

  const onSignUp = async () => {
    if (!validateForm()) return;

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

  return (
    <KeyboardAvoidingView
      style={commonStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={commonStyles.scrollContainer}>
        <Surface style={commonStyles.surface}>
          <Title style={commonStyles.title}>Criar conta</Title>

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
          />

          <TextInput
            label="CPF"
            value={cpf}
            onChangeText={(text) => setCpf(formatCPF(text))}
            keyboardType="numeric"
            style={commonStyles.input}
            maxLength={14}
          />

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
            secureTextEntry
            style={commonStyles.input}
          />

          <TextInput
            label="Confirmar senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            style={commonStyles.input}
          />

          <Checkbox.Item
            label="Quero me cadastrar como profissional"
            status={isProfessional ? 'checked' : 'unchecked'}
            onPress={() => setIsProfessional(!isProfessional)}
          />

          {error ? <HelperText type="error">{error}</HelperText> : null}

          <Button mode="contained" onPress={onSignUp} loading={loading} style={commonStyles.button}>
            Criar conta
          </Button>

          <Button onPress={() => navigation.navigate('Login')} compact>
            Já tenho conta
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
