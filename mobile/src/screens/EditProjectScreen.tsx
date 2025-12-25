import React from 'react';
import CreateProjectScreen from './CreateProjectScreen';
import { Project } from '../api/projects';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function EditProjectScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  // We will reuse CreateProjectScreen but set the header/title via params
  // Navigate here with param `project`
  return <CreateProjectScreen />;
}
