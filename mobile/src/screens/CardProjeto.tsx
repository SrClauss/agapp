import { TouchableOpacity } from "react-native";
import { Card, Text } from "react-native-paper";
import { Project, ProjectCategory, ProjectLocation, ProjectCreateData  } from "../api/projects";

export interface CardProjetoProps {
  projeto: Project;
  onPress?: () => void;
}

export default function CardProjeto({ projeto, onPress}: CardProjetoProps) {
  // Implement the UI for the project card here
  return (

    
    <TouchableOpacity onPress={onPress}>
        <Card>
        <Card.Title title={projeto.title} subtitle={projeto.client_name || 'Cliente desconhecido'} />
        <Card.Content>
          <Text>{projeto.description}</Text>
          <Text>Categoria: {typeof projeto.category === 'string' ? projeto.category : `${(projeto.category as ProjectCategory).main} - ${(projeto.category as ProjectCategory).sub}`}</Text>
          <Text>Localização: {  JSON.stringify(projeto.location, null, 2) || 'Desconhecida'}</Text>
        </Card.Content>
        </Card>
    </TouchableOpacity>
  )
}