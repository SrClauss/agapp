import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Portal, Dialog, Button, Text, TextInput, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface EvaluationModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (rating: number, comment: string, wouldRecommend: boolean) => Promise<void>;
  projectTitle: string;
  loading?: boolean;
}

export default function EvaluationModal({
  visible,
  onDismiss,
  onSubmit,
  projectTitle,
  loading = false,
}: EvaluationModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(rating, comment, wouldRecommend ?? false);
      // Reset form
      setRating(0);
      setComment('');
      setWouldRecommend(null);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <MaterialCommunityIcons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={40}
            color={star <= rating ? '#F59E0B' : '#D1D5DB'}
            onPress={() => setRating(star)}
            style={styles.star}
          />
        ))}
      </View>
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Avaliar Projeto</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyMedium" style={styles.projectTitle}>
              {projectTitle}
            </Text>

            <Divider style={styles.divider} />

            <Text variant="titleSmall" style={styles.label}>
              Como foi sua experiência? *
            </Text>
            {renderStars()}
            {rating > 0 && (
              <Text variant="bodySmall" style={styles.ratingText}>
                {getRatingLabel(rating)}
              </Text>
            )}

            <Text variant="titleSmall" style={[styles.label, { marginTop: 24 }]}>
              Deixe um comentário (opcional)
            </Text>
            <TextInput
              mode="outlined"
              value={comment}
              onChangeText={setComment}
              placeholder="Compartilhe sua experiência..."
              multiline
              numberOfLines={4}
              maxLength={500}
              style={styles.input}
              disabled={submitting}
            />
            <Text variant="bodySmall" style={styles.charCount}>
              {comment.length}/500
            </Text>

            <Text variant="titleSmall" style={[styles.label, { marginTop: 16 }]}>
              Recomendaria este projeto?
            </Text>
            <View style={styles.recommendContainer}>
              <Button
                mode={wouldRecommend === true ? 'contained' : 'outlined'}
                onPress={() => setWouldRecommend(true)}
                style={styles.recommendButton}
                disabled={submitting}
              >
                Sim
              </Button>
              <Button
                mode={wouldRecommend === false ? 'contained' : 'outlined'}
                onPress={() => setWouldRecommend(false)}
                style={styles.recommendButton}
                disabled={submitting}
              >
                Não
              </Button>
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={rating === 0 || submitting}
            loading={submitting}
          >
            Enviar Avaliação
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function getRatingLabel(rating: number): string {
  switch (rating) {
    case 1:
      return 'Péssimo';
    case 2:
      return 'Ruim';
    case 3:
      return 'Regular';
    case 4:
      return 'Bom';
    case 5:
      return 'Excelente';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  content: {
    paddingHorizontal: 24,
  },
  projectTitle: {
    color: '#6B7280',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },
  label: {
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 16,
  },
  star: {
    padding: 4,
  },
  ratingText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
  charCount: {
    textAlign: 'right',
    color: '#9CA3AF',
    marginTop: 4,
  },
  recommendContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  recommendButton: {
    flex: 1,
  },
});
