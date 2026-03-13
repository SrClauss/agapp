/**
 * Serviço de Ads para Banner e AdScreen
 * Usa endpoints /ads-mobile com verificação de versão para economia de bandwidth
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import client from './axiosClient';

// Tipos de target
export type AdTarget = 'client' | 'professional';

// Interface para imagem de banner
export interface BannerImage {
  filename: string;
  data: string; // Base64
  mime_type: string;
  action_type: 'none' | 'external' | 'internal';
  action_value: string | null;
  order: number;
}

// Interface para resposta de sync do banner
export interface BannerSyncResponse {
  version: number;
  images?: BannerImage[];
  updated_at?: string;
  up_to_date: boolean;
}

// Interface para banner armazenado localmente
export interface LocalBannerData {
  version: number;
  images: Array<{
    filename: string;
    localUri: string;
    action_type: string;
    action_value: string | null;
    order: number;
  }>;
  updated_at: string;
}

// Keys para AsyncStorage
const BANNER_VERSION_KEY = 'banner_version_';
const BANNER_METADATA_KEY = 'banner_metadata_';

// Diretório para armazenar imagens de banner
const getBannerImageDir = (target: AdTarget): string => {
  return `${(FileSystem as any).documentDirectory}ads/banners/${target}/`;
};

/**
 * Verifica a versão atual do banner no servidor
 */
export async function checkBannerVersion(target: AdTarget): Promise<number> {
  try {
    const response = await client.get(`/ads-mobile/banner/${target}/version`);
    return response.data?.version?.version || response.data?.version || 0;
  } catch (error) {
    console.error('[AdsService] Error checking banner version:', error);
    return 0;
  }
}

/**
 * Obtém a versão do banner armazenada localmente
 */
export async function getLocalBannerVersion(target: AdTarget): Promise<number> {
  try {
    const version = await AsyncStorage.getItem(`${BANNER_VERSION_KEY}${target}`);
    return version ? parseInt(version, 10) : 0;
  } catch (error) {
    console.error('[AdsService] Error getting local banner version:', error);
    return 0;
  }
}

/**
 * Obtém os metadados do banner armazenados localmente
 */
export async function getLocalBannerData(target: AdTarget): Promise<LocalBannerData | null> {
  try {
    const data = await AsyncStorage.getItem(`${BANNER_METADATA_KEY}${target}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[AdsService] Error getting local banner data:', error);
    return null;
  }
}

/**
 * Salva imagem de banner no sistema de arquivos local
 */
async function saveBannerImage(
  target: AdTarget,
  filename: string,
  base64Data: string,
  mimeType: string
): Promise<string> {
  const dir = getBannerImageDir(target);
  
  // Criar diretório se não existir
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch (e) {
    // Diretório já existe
  }
  
  const localPath = `${dir}${filename}`;
  
  try {
    await FileSystem.writeAsStringAsync(localPath, base64Data, {
      encoding: (FileSystem as any).EncodingType.Base64,
    });
    return localPath;
  } catch (error) {
    console.error('[AdsService] Error saving banner image:', error);
    // Retornar data URI como fallback
    return `data:${mimeType};base64,${base64Data}`;
  }
}

/**
 * Sincroniza banners com o servidor
 * - Verifica versão local vs servidor
 * - Se diferente, baixa novas imagens e salva localmente
 * - Retorna imagens do armazenamento local
 */
export async function syncBanners(target: AdTarget): Promise<LocalBannerData | null> {
  try {
    const localVersion = await getLocalBannerVersion(target);
    
    // Chamar endpoint de sync com versão atual
    const response = await client.get<BannerSyncResponse>(
      `/ads-mobile/banner/${target}`,
      { params: { current_version: localVersion } }
    );
    
    const data = response.data;
    
    // Se está atualizado, usar dados locais
    if (data.up_to_date) {
      console.log(`[AdsService] Banner ${target} is up to date (v${localVersion})`);
      return await getLocalBannerData(target);
    }
    
    // Versão diferente - processar novas imagens
    console.log(`[AdsService] Updating banner ${target} from v${localVersion} to v${data.version}`);
    
    if (!data.images || data.images.length === 0) {
      // Limpar dados locais se não há imagens
      await AsyncStorage.removeItem(`${BANNER_VERSION_KEY}${target}`);
      await AsyncStorage.removeItem(`${BANNER_METADATA_KEY}${target}`);
      return null;
    }
    
    // Salvar imagens localmente
    const localImages: LocalBannerData['images'] = [];
    
    for (const img of data.images) {
      const localUri = await saveBannerImage(target, img.filename, img.data, img.mime_type);
      localImages.push({
        filename: img.filename,
        localUri,
        action_type: img.action_type,
        action_value: img.action_value,
        order: img.order,
      });
    }
    
    // Ordenar por order
    localImages.sort((a, b) => a.order - b.order);
    
    // Salvar metadados
    const localData: LocalBannerData = {
      version: data.version,
      images: localImages,
      updated_at: data.updated_at || new Date().toISOString(),
    };
    
    await AsyncStorage.setItem(`${BANNER_VERSION_KEY}${target}`, String(data.version));
    await AsyncStorage.setItem(`${BANNER_METADATA_KEY}${target}`, JSON.stringify(localData));
    
    console.log(`[AdsService] Banner ${target} updated to v${data.version} with ${localImages.length} images`);
    
    return localData;
  } catch (error) {
    console.error('[AdsService] Error syncing banners:', error);
    // Em caso de erro, tentar usar dados locais
    return await getLocalBannerData(target);
  }
}

/**
 * Limpa cache de banners
 */
export async function clearBannerCache(target?: AdTarget): Promise<void> {
  try {
    if (target) {
      await AsyncStorage.removeItem(`${BANNER_VERSION_KEY}${target}`);
      await AsyncStorage.removeItem(`${BANNER_METADATA_KEY}${target}`);
      
      const dir = getBannerImageDir(target);
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
    } else {
      // Limpar tudo
      for (const t of ['client', 'professional'] as AdTarget[]) {
        await clearBannerCache(t);
      }
    }
  } catch (error) {
    console.error('[AdsService] Error clearing banner cache:', error);
  }
}


// ============================================================================
// ADSCREEN SERVICE
// ============================================================================

// Interface para resposta de sync do AdScreen
export interface AdScreenSyncResponse {
  version: number;
  zip_data?: string; // Base64
  zip_filename?: string;
  zip_size?: number;
  action_type?: string;
  action_value?: string | null;
  updated_at?: string;
  up_to_date: boolean;
}

// Interface para AdScreen armazenado localmente
export interface LocalAdScreenData {
  version: number;
  htmlPath: string;
  actionType: string;
  actionValue: string | null;
  updatedAt: string;
}

// Keys para AsyncStorage
const ADSCREEN_VERSION_KEY = 'adscreen_version_';
const ADSCREEN_METADATA_KEY = 'adscreen_metadata_';

// Diretório para armazenar AdScreen extraído
const getAdScreenDir = (target: AdTarget): string => {
  return `${(FileSystem as any).documentDirectory}ads/adscreen/${target}/`;
};

/**
 * Verifica a versão atual do AdScreen no servidor
 */
export async function checkAdScreenVersion(target: AdTarget): Promise<number> {
  try {
    const response = await client.get(`/ads-mobile/adscreen/${target}/version`);
    return response.data?.version?.version || response.data?.version || 0;
  } catch (error) {
    console.error('[AdsService] Error checking adscreen version:', error);
    return 0;
  }
}

/**
 * Obtém a versão do AdScreen armazenada localmente
 */
export async function getLocalAdScreenVersion(target: AdTarget): Promise<number> {
  try {
    const version = await AsyncStorage.getItem(`${ADSCREEN_VERSION_KEY}${target}`);
    return version ? parseInt(version, 10) : 0;
  } catch (error) {
    console.error('[AdsService] Error getting local adscreen version:', error);
    return 0;
  }
}

/**
 * Obtém os metadados do AdScreen armazenados localmente
 */
export async function getLocalAdScreenData(target: AdTarget): Promise<LocalAdScreenData | null> {
  try {
    const data = await AsyncStorage.getItem(`${ADSCREEN_METADATA_KEY}${target}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[AdsService] Error getting local adscreen data:', error);
    return null;
  }
}

/**
 * Extrai ZIP do AdScreen e salva no sistema de arquivos local
 * Retorna o caminho do index.html
 */
async function extractAdScreenZip(
  target: AdTarget,
  zipBase64: string
): Promise<string | null> {
  const dir = getAdScreenDir(target);
  
  // Criar diretório se não existir
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch (e) {
    // Diretório já existe
  }
  
  // Salvar ZIP temporariamente
  const zipPath = `${dir}_temp.zip`;
  
  try {
    await FileSystem.writeAsStringAsync(zipPath, zipBase64, {
      encoding: (FileSystem as any).EncodingType.Base64,
    });
    
    // Nota: Expo FileSystem não tem suporte nativo para extrair ZIPs
    // Precisamos usar uma biblioteca como 'react-native-zip-archive' ou 'jszip'
    // Por enquanto, vamos armazenar o ZIP e usar uma abordagem alternativa
    
    // Para uma implementação completa, você precisa:
    // 1. Instalar: npx expo install react-native-zip-archive
    // 2. Usar: import { unzip } from 'react-native-zip-archive';
    // 3. Chamar: await unzip(zipPath, dir);
    
    console.log('[AdsService] ZIP saved to:', zipPath);
    console.log('[AdsService] Note: ZIP extraction requires react-native-zip-archive library');
    
    // Por agora, retornamos null indicando que a extração não foi implementada
    // O sistema deve cair para o fallback de usar diretamente os dados do servidor
    return null;
    
  } catch (error) {
    console.error('[AdsService] Error extracting adscreen ZIP:', error);
    return null;
  }
}

/**
 * Sincroniza AdScreen com o servidor
 * - Verifica versão local vs servidor
 * - Se diferente, baixa novo ZIP e salva localmente
 * - Retorna dados do AdScreen local
 */
export async function syncAdScreen(target: AdTarget): Promise<LocalAdScreenData | null> {
  try {
    const localVersion = await getLocalAdScreenVersion(target);
    
    // Chamar endpoint de sync com versão atual
    const response = await client.get<AdScreenSyncResponse>(
      `/ads-mobile/adscreen/${target}`,
      { params: { current_version: localVersion } }
    );
    
    const data = response.data;
    
    // Se está atualizado, usar dados locais
    if (data.up_to_date) {
      console.log(`[AdsService] AdScreen ${target} is up to date (v${localVersion})`);
      return await getLocalAdScreenData(target);
    }
    
    // Versão diferente - processar novo ZIP
    console.log(`[AdsService] Updating AdScreen ${target} from v${localVersion} to v${data.version}`);
    
    if (!data.zip_data) {
      // Limpar dados locais se não há ZIP
      await AsyncStorage.removeItem(`${ADSCREEN_VERSION_KEY}${target}`);
      await AsyncStorage.removeItem(`${ADSCREEN_METADATA_KEY}${target}`);
      return null;
    }
    
    // Extrair ZIP (se implementado)
    const htmlPath = await extractAdScreenZip(target, data.zip_data);
    
    // Salvar metadados
    const localData: LocalAdScreenData = {
      version: data.version,
      htmlPath: htmlPath || '', // Pode ser vazio se extração não implementada
      actionType: data.action_type || 'none',
      actionValue: data.action_value || null,
      updatedAt: data.updated_at || new Date().toISOString(),
    };
    
    await AsyncStorage.setItem(`${ADSCREEN_VERSION_KEY}${target}`, String(data.version));
    await AsyncStorage.setItem(`${ADSCREEN_METADATA_KEY}${target}`, JSON.stringify(localData));
    
    console.log(`[AdsService] AdScreen ${target} updated to v${data.version}`);
    
    return localData;
  } catch (error) {
    console.error('[AdsService] Error syncing adscreen:', error);
    // Em caso de erro, tentar usar dados locais
    return await getLocalAdScreenData(target);
  }
}

/**
 * Limpa cache de AdScreen
 */
export async function clearAdScreenCache(target?: AdTarget): Promise<void> {
  try {
    if (target) {
      await AsyncStorage.removeItem(`${ADSCREEN_VERSION_KEY}${target}`);
      await AsyncStorage.removeItem(`${ADSCREEN_METADATA_KEY}${target}`);
      
      const dir = getAdScreenDir(target);
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
    } else {
      // Limpar tudo
      for (const t of ['client', 'professional'] as AdTarget[]) {
        await clearAdScreenCache(t);
      }
    }
  } catch (error) {
    console.error('[AdsService] Error clearing adscreen cache:', error);
  }
}
