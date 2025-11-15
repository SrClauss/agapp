/**
 * Helper para criar estilos com acesso ao tema
 * Use esta função para criar StyleSheets que usam o tema
 */

import { StyleSheet } from 'react-native';
import { theme, Theme } from './index';

type StylesCreator<T> = (theme: Theme) => T;

export function createStyles<T extends StyleSheet.NamedStyles<T>>(
  stylesCreator: StylesCreator<T>
): T {
  return StyleSheet.create(stylesCreator(theme));
}

export default createStyles;
