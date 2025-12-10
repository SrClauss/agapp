import React, { useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, TextInput, Surface, Title, HelperText, RadioButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
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

  const handleRoleChange = (role: string) => {
    if (role === 'both') {
      setRoles(['client', 'professional']);
    } else {
      setRoles([role]);
    }
  };

  const onCompleteProfile = async () => {
    if (!token || !user) {
      setError('Token ou usuário não encontrado');
      return;
    }
    if (password !== confirmPassword) {
      setError('Senhas não coincidem');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log('Enviando dados para completar perfil:', { phone, cpf, full_name: user.full_name, password: '***', roles });
      const updatedUser = await completeProfile(token, {
        phone,
        cpf,
        full_name: user.full_name, // Usar o nome do Google
        password,
        roles,
      });
      console.log('Perfil completado:', updatedUser);
      // Atualizar user com avatar_url se disponível
      const userWithPhoto = { ...updatedUser, avatar_url: user?.avatar_url };
      setUser(userWithPhoto);
      // Navigate based on user roles
      const destination = updatedUser.roles.includes('client') ? 'WelcomeCustomer' : 'ProfessionalHome';
      navigation.navigate(destination as never);
    } catch (e: any) {
      console.error('Erro ao completar perfil:', e);
      setError(e.message || 'Erro ao completar perfil');
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
        />

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
          secureTextEntry
          style={commonStyles.input}
        />

        <TextInput
          label="Confirmar Senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          style={commonStyles.input}
        />

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
      </Surface>
    </ScrollView>
  );
}