import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params);
  }
}

export function resetRoot(state: { index: number; routes: { name: keyof RootStackParamList; params?: any }[] }) {
  if (navigationRef.isReady()) {
    navigationRef.reset(state as any);
  }
}

export default { navigationRef, navigate, resetRoot };
