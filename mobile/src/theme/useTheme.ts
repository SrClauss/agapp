/**
 * Hook personalizado para acessar o tema
 * Use este hook em qualquer componente para acessar as cores, fontes e espaçamentos
 */

import { theme } from './index';

export const useTheme = () => {
  return theme;
};

// Exportar também como default
export default useTheme;
