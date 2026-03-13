import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function BuyFeaturedProjectsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compra de Projetos Destacados</Text>
      <Text style={styles.body}>
        Aqui você poderá adquirir serviços ou projetos em destaque.
        (Conteúdo ainda não implementado)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
  },
});