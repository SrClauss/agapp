import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Surface, Title, Paragraph } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import { commonStyles } from '../theme/styles';

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s: AuthState) => s.user);

  return (
    <View style={commonStyles.centeredContainer}>
      <Surface style={commonStyles.surface}>
        <Title style={commonStyles.title}>🎉 Bem-vindo(a)!</Title>

        <Paragraph style={commonStyles.body}>
          Olá, {user?.full_name || 'Usuário'}!
        </Paragraph>

        <Paragraph style={commonStyles.body}>
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
          style={commonStyles.button}
        >
          Continuar
        </Button>
      </Surface>
    </View>
  );
}
