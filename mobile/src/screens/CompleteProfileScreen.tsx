import React, { useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, TextInput, Surface, Title, HelperText, RadioButton, Snackbar } from 'react-native-paper';
import { isValidCPF } from '../utils/cpf';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import { getRouteForRoles } from '../utils/roles';
import { completeProfile } from '../api/auth';
import { commonStyles } from '../theme/styles';

export default function CompleteProfileScreen() {
  const navigation = useNavigation();
  const authStore = useAuthStore();
  const token = authStore.token;
  const user = authStore.user;
  const setUser = authStore.setUser;
  const setToken = authStore.setToken;

  console.log('🔍 [CompleteProfile] Renderizando - Token:', token ? 'Existe ✓' : 'NULL ✗');
  console.log('🔍 [CompleteProfile] Renderizando - User:', user ? user.email : 'NULL ✗');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roles, setRoles] = useState<string[]>(['client']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const handleRoleChange = (role: string) => {
    if (role === 'both') {
      setRoles(['client', 'professional']);
    } else {
      setRoles([role]);
    }
  };

  // Prefill cpf/phone/roles/fullName from current user when available
  React.useEffect(() => {
    if (user) {
      // Remove qualquer formatação do CPF que venha do servidor
      const cleanCpf = user?.cpf ? user.cpf.replace(/\D/g, '') : '';
      // Só preenche se não for um CPF temporário
      setCpf(cleanCpf === '00000000000' ? '' : cleanCpf);
      setPhone(user?.phone || '');
      setRoles(user?.roles || ['client']);
      setFullName(user?.full_name || '');
      setEmail(user?.email || ''); // Adiciona o e-mail
      setPassword(''); // Preenche a senha com valor padrão
      setConfirmPassword(''); // Preenche a confirmação de senha com valor padrão
    }
  }, [user]);

  const onCompleteProfile = async () => {
    console.log('🔍 [CompleteProfile] Token:', token ? 'Existe' : 'NULL');
    console.log('🔍 [CompleteProfile] User:', user ? user.email : 'NULL');

    if (!token) {
      setError('Token não encontrado. Faça login novamente.');
      return;
    }
    if (!fullName.trim()) {
      setError('Nome completo é obrigatório');
      return;
    }
    if (password !== confirmPassword) {
      setError('Senhas não coincidem');
      return;
    }

    // CPF validation - only validate if user entered a real CPF (not temporary)
    const isTemporaryCpf = !cpf || cpf === '000.000.000-00' || cpf.replace(/\D/g, '') === '00000000000';
    if (!isTemporaryCpf && !isValidCPF(cpf)) {
      setError('CPF inválido');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Preparar payload e enviar somente senha se fornecida
      const payload: any = {
        phone,
        full_name: fullName, // Usar o nome editável
        roles,
      };

      // Only send CPF if it's not temporary (user actually entered a real CPF)
      if (!isTemporaryCpf) {
        payload.cpf = cpf;
      }

      if (password) payload.password = password;

      const updatedUser = await completeProfile(token, payload);

      // If password was provided, log in with email/password to get fresh tokens
      if (password && updatedUser.email) {
        try {
          // Import login function lazily to avoid circular deps
          const { loginWithEmail } = await import('../api/auth');
          // Use current token in Authorization header to bypass Turnstile for auto-login
          const loginResult = await loginWithEmail(updatedUser.email, password, undefined, token);
          // Save token and user
          await setToken(loginResult.token);
          setUser(loginResult.user || { ...updatedUser, avatar_url: user?.avatar_url });
          setSnackbarMsg('Perfil atualizado e logado com sucesso');
          setSnackbarVisible(true);
        } catch (loginErr: any) {
          // Profile updated but login failed - keep updated user in store
          const userWithPhoto = { ...updatedUser, avatar_url: user?.avatar_url };
          setUser(userWithPhoto);
          setSnackbarMsg(loginErr.message || 'Perfil atualizado, mas falha no login automático');
          setSnackbarVisible(true);
        }
      } else {
        // Atualizar user com avatar_url se disponível
        const userWithPhoto = { ...updatedUser, avatar_url: user?.avatar_url };
        setUser(userWithPhoto);

        // Feedback ao usuário
        setSnackbarMsg('Perfil atualizado com sucesso');
        setSnackbarVisible(true);
      }

      // Navigate based on user roles using helper util (professionals temporarily routed to ProfileSelection)
      const destination = getRouteForRoles(updatedUser.roles, undefined);

      // Navegar após pequena pausa para o usuário ver o Snackbar
      setTimeout(() => navigation.navigate(destination as never), 700);
    } catch (e: any) {
      setError(e.message || 'Erro ao completar perfil');
      setSnackbarMsg(e.message || 'Erro ao completar perfil');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContainer}>
      <Surface style={commonStyles.surface}>
        <Title style={commonStyles.title}>Completar Perfil</Title>

        <TextInput
          label="Nome Completo"
          value={fullName}
          onChangeText={setFullName}
          style={commonStyles.input}
        />

        <TextInput
          label="E-mail"
          value={email}
          editable={false} // Campo somente leitura
          style={commonStyles.input}
        />

        <TextInput
          label="CPF"
          value={cpf}
          onChangeText={(text) => setCpf(text.replace(/\D/g, ''))} // Remove qualquer caractere não numérico
          keyboardType="numeric"
          style={commonStyles.input}
        />
        <HelperText type="info">Digite seu CPF completo (apenas números, sem formatação)</HelperText>

        <TextInput
          label="Telefone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={commonStyles.input}
        />

        <TextInput
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={true} // Campo de senha
          style={commonStyles.input}
        />

        <TextInput
          label="Confirmar Senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={true} // Campo de senha
          style={commonStyles.input}
        />
        <HelperText type="info">Deixe em branco para manter sua senha atual</HelperText>

        <Title style={commonStyles.subtitle}>Função</Title>
        <RadioButton.Group onValueChange={handleRoleChange} value={roles.includes('professional') && roles.includes('client') ? 'both' : roles[0] || 'client'}>
          <RadioButton.Item label="Cliente" value="client" />
          <RadioButton.Item label="Profissional" value="professional" />
          <RadioButton.Item label="Ambos" value="both" />
        </RadioButton.Group>

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Button mode="contained" onPress={onCompleteProfile} loading={loading} style={commonStyles.button}>
          Completar Perfil
        </Button>

        <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={1500}>
          {snackbarMsg}
        </Snackbar>
      </Surface>
    </ScrollView>
  );
}