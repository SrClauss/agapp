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
  const token = useAuthStore((s: AuthState) => s.token);
  const user = useAuthStore((s: AuthState) => s.user);
  const setUser = useAuthStore((s: AuthState) => s.setUser);

  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roles, setRoles] = useState<string[]>(['client']); // Default to client
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

  // Prefill cpf/phone/roles from current user when available
  React.useEffect(() => {
    if (user) {
      setCpf(user.cpf || '');
      setPhone(user.phone || '');
      setRoles(user.roles || ['client']);
    }
  }, [user]);

  const onCompleteProfile = async () => {
    if (!token || !user) {
      setError('Token ou usuário não encontrado');
      return;
    }
    if (password !== confirmPassword) {
      setError('Senhas não coincidem');
      return;
    }

    // CPF validation
    if (!isValidCPF(cpf)) {
      setError('CPF inválido');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Preparar payload e enviar somente senha se fornecida
      const payload: any = {
        phone,
        cpf,
        full_name: user.full_name, // Usar o nome do Google
        roles,
      };
      if (password) payload.password = password;

      const updatedUser = await completeProfile(token, payload);

      // Atualizar user com avatar_url se disponível
      const userWithPhoto = { ...updatedUser, avatar_url: user?.avatar_url };
      setUser(userWithPhoto);

      // Feedback ao usuário
      setSnackbarMsg('Perfil atualizado com sucesso');
      setSnackbarVisible(true);

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
          value={user?.full_name || ''}
          editable={false}
          style={commonStyles.input}
        />

        <TextInput
          label="CPF"
          value={cpf}
          onChangeText={setCpf}
          keyboardType="numeric"
          style={commonStyles.input}
          editable={!user?.cpf}
        />
        {user?.cpf ? <HelperText type="info">CPF já cadastrado e não pode ser alterado</HelperText> : null}

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
          secureTextEntry={!showPassword}
          style={commonStyles.input}
          right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(!showPassword)} />}
        />

        <TextInput
          label="Confirmar Senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          style={commonStyles.input}
          right={<TextInput.Icon icon={showConfirmPassword ? 'eye-off' : 'eye'} onPress={() => setShowConfirmPassword(!showConfirmPassword)} />}
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