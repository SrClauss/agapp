import { Project, getProject, ContactSummary } from "../api/projects";
import { useEffect, useState } from "react";
import { Text, Avatar } from "react-native-paper";
import { View } from "react-native";


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

    const contacts: ContactSummary[] = (fullProject && (fullProject as any).contacts) || [];

    return (
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#ccc' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{fullProject?.title}</Text>
        <Text>{fullProject?.description}</Text>

        {contacts.length === 0 ? (
          <Text style={{ marginTop: 8 }}>Nenhum profissional interessado ainda.</Text>
        ) : (
          contacts.map((contact, index) => (
            <View key={contact.id || index} style={{ marginTop: 8, padding: 8, backgroundColor: '#f9f9f9', borderRadius: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {contact.professional_avatar ? (
                  <Avatar.Image size={40} source={{ uri: contact.professional_avatar }} />
                ) : (
                  <Avatar.Text size={40} label={contact.professional_name ? contact.professional_name.charAt(0) : '?'} />
                )}
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ fontWeight: 'bold' }}>{contact.professional_name}</Text>
                  <Text style={{ color: '#666' }}>{contact.status} • {contact.created_at ? new Date(contact.created_at).toLocaleString() : ''}</Text>
                </View>
              </View>

              <Text style={{ marginTop: 8 }}>{contact.contact_details?.message || (contact.contact_details?.proposal_price ? `Proposta: R$${contact.contact_details.proposal_price}` : 'Sem detalhes adicionais.')}</Text>

              {contact.last_message && (
                <Text style={{ marginTop: 8, marginLeft: 8, color: '#444' }}>Última mensagem — {contact.last_message.sender_id}: {contact.last_message.content}</Text>
              )}

              {contact.unread_count > 0 && (
                <Text style={{ marginTop: 4, color: 'red' }}>{contact.unread_count} mensagens não lidas</Text>
              )}
            </View>
          ))
        )}
      </View>
    );


}




