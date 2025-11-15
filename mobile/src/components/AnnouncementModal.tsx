import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Portal, Dialog, Text, Button } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography } from '../theme';
import { Announcement } from './AnnouncementBanner';
import apiService from '../services/api';

interface AnnouncementModalProps {
  onClose?: () => void;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ onClose }) => {
  const [visible, setVisible] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    checkForModalAnnouncements();
  }, []);

  const checkForModalAnnouncements = async () => {
    try {
      const token = await apiService.getToken();
      if (!token) return;

      // Busca anúncios do tipo modal
      const modalAnnouncements = await apiService.getAnnouncementsByType(token, 'modal', 1);

      if (modalAnnouncements.length > 0) {
        const modalAnnouncement = modalAnnouncements[0];

        // Verifica se o usuário já viu este anúncio
        const viewedKey = `announcement_viewed_${modalAnnouncement.id}`;
        const alreadyViewed = await AsyncStorage.getItem(viewedKey);

        if (!alreadyViewed) {
          setAnnouncement(modalAnnouncement);
          setVisible(true);

          // Registra visualização
          await apiService.registerAnnouncementInteraction(token, modalAnnouncement.id, 'view');

          // Marca como visualizado
          await AsyncStorage.setItem(viewedKey, 'true');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar anúncios modal:', error);
    }
  };

  const handleClose = () => {
    setVisible(false);
    if (onClose) {
      onClose();
    }
  };

  const handleAction = async () => {
    if (!announcement) return;

    try {
      const token = await apiService.getToken();
      if (token) {
        await apiService.registerAnnouncementInteraction(token, announcement.id, 'click');
      }
    } catch (error) {
      console.error('Erro ao registrar click:', error);
    }

    // Handle CTA - aqui você pode adicionar navegação ou outras ações
    handleClose();
  };

  if (!announcement) return null;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleClose} style={styles.dialog}>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <View style={styles.content}>
            {announcement.image_url && (
              <Image
                source={{ uri: announcement.image_url }}
                style={styles.image}
                resizeMode="cover"
              />
            )}

            <Text style={styles.title}>{announcement.title}</Text>
            <Text style={styles.description}>{announcement.description}</Text>
          </View>
        </Dialog.ScrollArea>

        <Dialog.Actions>
          <Button onPress={handleClose} textColor={colors.textSecondary}>
            Fechar
          </Button>
          {announcement.cta_text && (
            <Button
              onPress={handleAction}
              mode="contained"
              buttonColor={colors.primary}
            >
              {announcement.cta_text}
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  content: {
    padding: spacing.base,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: spacing.sm,
    marginBottom: spacing.base,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});

export default AnnouncementModal;
