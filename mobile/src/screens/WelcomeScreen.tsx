import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Surface, Title, Paragraph } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s: AuthState) => s.user);

  return (
    <View style={styles.container}>
      <Surface style={styles.surface} elevation={4}>
        <Title style={styles.title}>🎉 Bem-vindo(a)!</Title>

        <Paragraph style={styles.paragraph}>
          Olá, {user?.full_name || 'Usuário'}!
        </Paragraph>

        <Paragraph style={styles.paragraph}>
          Seu login foi realizado com sucesso.
          Estamos felizes em ter você aqui!
        </Paragraph>

        <Button
          mode="contained"
          onPress={() => {
            // Aqui você pode navegar para a tela principal do app
            // navigation.navigate('Home');
            console.log('Continuar para o app');
          }}
          style={styles.button}
        >
          Continuar
        </Button>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  surface: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    marginBottom: 24,
    textAlign: 'center',
  },
  paragraph: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 32,
  },
});
