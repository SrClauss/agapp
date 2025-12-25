import React from 'react';
import CreateProjectScreen from './CreateProjectScreen';
import { Project } from '../api/projects';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function EditProjectScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as { project?: Project };
  // Reuse CreateProjectScreen but explicitly pass the project param so it has the id
  return <CreateProjectScreen overrideParams={params as any} />;
}
