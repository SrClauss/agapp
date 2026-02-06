import { Project, getProject } from "../api/projects";
import { useEffect, useState } from "react";
import { Text } from "react-native-paper";


export function ProjectContactedCard({ project }: { project: Project }) {
    const [fullProject, setFullProject] = useState<Project | null>(null);

    useEffect(() => {
        async function loadProject() {
            try {
                const data = await getProject(project._id);
                setFullProject(data);
            } catch (err) {
                console.error("Erro ao carregar projeto completo:", err);
            }
        }
        loadProject();
    }, [project._id]);



    return (
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#ccc' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{fullProject?.title}</Text>
        <Text>{fullProject?.description}</Text>
        {fullProject?.contacts?.map((contact, index) => (
          <View key={index} style={{ marginTop: 8, padding: 8, backgroundColor: '#f9f9f9' }}>
            <Text>Tipo: {contact.contact_type}</Text>
            <Text>Profissional: {contact.professional_name}</Text>
            <Text>Status: {contact.status}</Text>
            <Text>Detalhes: {JSON.stringify(contact.contact_details)}</Text>
            {contact.chats?.map((chat, chatIndex) => (
              <Text key={chatIndex} style={{ marginLeft: 16 }}>
                {chat.sender_id}: {chat.message}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );


}




