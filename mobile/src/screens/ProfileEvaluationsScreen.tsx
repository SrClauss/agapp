import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Text, Card, Appbar } from 'react-native-paper';
import { getUserEvaluations, Evaluation } from '../api/users';
import useAuthStore from '../stores/authStore';
import { useNavigation } from '@react-navigation/native';

export default function ProfileEvaluationsScreen() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();
  const navigation = useNavigation();
  
  useEffect(() => {
    const load = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      
      try {
        const data = await getUserEvaluations(token);
        setEvaluations(data);
      } catch (e) {
        console.error('Failed to load evaluations', e);
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [token]);
  
  const renderEvaluation = ({ item }: { item: Evaluation }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Text style={styles.clientName}>{item.client_name || 'Cliente'}</Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text key={star} style={styles.star}>
                {star <= item.rating ? '⭐' : '☆'}
              </Text>
            ))}
          </View>
        </View>
        {item.comment && (
          <Text style={styles.comment}>{item.comment}</Text>
        )}
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })}
        </Text>
      </Card.Content>
    </Card>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Minhas Avaliações" />
      </Appbar.Header>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={evaluations}
          keyExtractor={(item) => item.id}
          renderItem={renderEvaluation}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhuma avaliação ainda.</Text>
              <Text style={styles.emptyHint}>
                Complete trabalhos para receber avaliações dos clientes.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  card: { marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clientName: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  ratingContainer: { flexDirection: 'row' },
  star: { fontSize: 20, marginLeft: 2 },
  comment: { fontSize: 14, marginTop: 8, color: '#333', lineHeight: 20 },
  date: { fontSize: 12, color: '#999', marginTop: 8 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyHint: { fontSize: 14, color: '#666', textAlign: 'center' }
});
