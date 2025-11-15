import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { colors, spacing, typography } from '../theme';

export interface Announcement {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  type: string;
  cta_text?: string;
  cta_link?: string;
  priority: number;
  html_content?: string;
}

interface AnnouncementBannerProps {
  announcement: Announcement;
  onPress?: () => void;
  onView?: (id: string) => void;
  compact?: boolean;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  announcement,
  onPress,
  onView,
  compact = false,
}) => {
  const [viewed, setViewed] = React.useState(false);

  React.useEffect(() => {
    if (!viewed && onView) {
      onView(announcement.id);
      setViewed(true);
    }
  }, [announcement.id, viewed, onView]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  const renderContent = () => {
    if (compact) {
      return (
        <View style={styles.compactContent}>
          {announcement.image_url && (
            <Image
              source={{ uri: announcement.image_url }}
              style={styles.compactImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.compactText}>
            <Text style={styles.compactTitle} numberOfLines={1}>
              {announcement.title}
            </Text>
            <Text style={styles.compactDescription} numberOfLines={2}>
              {announcement.description}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.content}>
        {announcement.image_url && (
          <Image
            source={{ uri: announcement.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
        <View style={styles.textContent}>
          <Text style={styles.title}>{announcement.title}</Text>
          <Text style={styles.description}>{announcement.description}</Text>
          {announcement.cta_text && (
            <Button
              mode="contained"
              onPress={handlePress}
              style={styles.ctaButton}
              buttonColor={colors.primary}
              compact
            >
              {announcement.cta_text}
            </Button>
          )}
        </View>
      </View>
    );
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Card style={[styles.card, compact && styles.compactCard]}>
        {renderContent()}
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    overflow: 'hidden',
  },
  compactCard: {
    marginBottom: spacing.sm,
  },
  content: {
    padding: 0,
  },
  image: {
    width: '100%',
    height: 150,
  },
  textContent: {
    padding: spacing.base,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  ctaButton: {
    alignSelf: 'flex-start',
  },
  compactContent: {
    flexDirection: 'row',
    padding: spacing.sm,
    alignItems: 'center',
  },
  compactImage: {
    width: 60,
    height: 60,
    borderRadius: spacing.xs,
    marginRight: spacing.sm,
  },
  compactText: {
    flex: 1,
  },
  compactTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  compactDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});

export default AnnouncementBanner;
