import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button,  Divider,  Text, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import LocationAvatar from '../components/LocationAvatar';

export default function WelcomeCustomerScreen() {
  const navigation = useNavigation();
  const logout = useAuthStore((s: AuthState) => s.logout);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
      navigation.navigate('Login' as never);
    } catch (err) {
      console.warn('Logout falhou', err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {

    console.log('WelcomeCustomerScreen mounted');
    // You can add any initialization logic here if needed
  }, [searchQuery]);

  return (
    <View style={styles.containerWelcome}>
      <LocationAvatar />

      <TextInput
        style={styles.textInput}
        label="O que você está procurando hoje?"
        mode='outlined'
        value={searchQuery}
        onChangeText={text => setSearchQuery(text)}
        left={<TextInput.Icon icon="magnify" />}
        
      />
      <Button mode="contained" style={{ marginTop: 20 }} onPress={() => {}}>
        Buscar
      </Button>
      
      <Button mode="outlined" onPress={handleLogout} loading={loading} style={{ marginTop: 12 }}>
        Sair
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  containerWelcome: {

    paddingTop: 40,
    paddingHorizontal: 20,
  },
  textInput: {
    marginTop: 20,
  }
});
