import React, { useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, TextInput, Surface, Title, HelperText, RadioButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import { completeProfile } from '../api/auth';

export default function CompleteProfileScreen() {
  const navigation = useNavigation();
  const token = useAuthStore((s: AuthState) => s.token);
  const setUser = useAuthStore((s: AuthState) => s.setUser);

  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
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
    if (!token) {
      setError('Token não encontrado');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updatedUser = await completeProfile(token, {
        phone,
        cpf,
        full_name: fullName,
        password,
        roles,
      });
      setUser(updatedUser);
      navigation.navigate('Welcome' as never);
    } catch (e: any) {
      setError(e.message || 'Erro ao completar perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Surface style={styles.surface} elevation={2}>
        <Title style={styles.title}>Completar Perfil</Title>

        <TextInput
          label="Nome Completo"
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
        />

        <TextInput
          label="CPF"
          value={cpf}
          onChangeText={setCpf}
          keyboardType="numeric"
          style={styles.input}
        />

        <TextInput
          label="Telefone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={styles.input}
        />

        <TextInput
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        <Title style={styles.subtitle}>Função</Title>
        <RadioButton.Group onValueChange={handleRoleChange} value={roles.includes('professional') && roles.includes('client') ? 'both' : roles[0] || 'client'}>
          <RadioButton.Item label="Cliente" value="client" />
          <RadioButton.Item label="Profissional" value="professional" />
          <RadioButton.Item label="Ambos" value="both" />
        </RadioButton.Group>

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Button mode="contained" onPress={onCompleteProfile} loading={loading} style={styles.button}>
          Completar Perfil
        </Button>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  surface: { padding: 20, borderRadius: 8 },
  title: { marginBottom: 12 },
  subtitle: { marginTop: 12, marginBottom: 8 },
  input: { marginBottom: 12 },
  button: { marginTop: 12 },
});