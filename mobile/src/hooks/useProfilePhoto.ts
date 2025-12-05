import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import useAuthStore from '../stores/authStore';

/**
 * Ensures a user's profile photo is cached locally and returns a local uri.
 * If user has photo_local, returns it immediately (and validates existence).
 */
export function useProfilePhoto(userId?: string | null, remotePhotoUrl?: string | null) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    let mounted = true;
    async function ensure() {
      if (!userId || !remotePhotoUrl) return;

      try {
        // Determine extension from remote URL or default .jpg
        const extMatch = remotePhotoUrl.split('?')[0].split('.').pop() || 'jpg';
        const filename = `profile_${userId}.${extMatch}`;
        const folder = `${FileSystem.cacheDirectory}profile/`;
        await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});
        const localPath = `${folder}${filename}`;

        // If we already have a local copy and file exists, use it
        const info = await FileSystem.getInfoAsync(localPath);
        if (info.exists) {
          if (mounted) setLocalUri(localPath);
          // Update store if not present
          if (user && user.photo_local !== localPath) {
            setUser({ ...user, photo_local: localPath });
          }
          return;
        }

        // If remote is already a local file URI (file://), just set it
        if (remotePhotoUrl.startsWith('file://')) {
          if (mounted) setLocalUri(remotePhotoUrl);
          if (user && user.photo_local !== remotePhotoUrl) {
            setUser({ ...user, photo_local: remotePhotoUrl });
          }
          return;
        }

        // Otherwise, download remote image
        const result = await FileSystem.downloadAsync(remotePhotoUrl, localPath);
        if (result.status === 200 && mounted) {
          setLocalUri(result.uri);
          if (user && user.photo_local !== result.uri) {
            setUser({ ...user, photo_local: result.uri });
          }
        }
      } catch (err) {
        console.error('Erro ao baixar imagem de perfil:', err);
      }
    }

    ensure();
    return () => { mounted = false; };
  }, [userId, remotePhotoUrl]);

  return { localUri };
}
