import { getApiUrl } from '../config/api.config';

export interface UserCreateRequest {
  email: string;
  full_name: string;
  cpf: string;
  phone?: string;
  password: string;
  roles?: string[];
  turnstile_token?: string;
}

export interface UserResponse {
  _id: string;
  email: string;
  full_name: string;
  cpf: string;
  phone?: string;
  roles: string[];
  is_active: boolean;
  credits: number;
  created_at: string;
  updated_at: string;
  skills?: string[];
  notification_preferences?: {
    enabled: boolean;
    radius_km: number;
    match_skills: boolean;
  };
}

export interface UserProfileUpdate {
  skills?: string[];
  notification_preferences?: {
    enabled: boolean;
    radius_km: number;
    match_skills: boolean;
  };
}

export interface LoginRequest {
  username: string; // email
  password: string;
  turnstile_token?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export interface ApiError {
  detail: string;
}

export interface Category {
  _id: string;
  name: string;
  subcategories: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  default_remote_execution?: boolean;
}

export interface ProjectCategory {
  main: string;
  sub: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  system?: boolean;
}

export interface ProjectChat {
  professional_id: string;
  messages: ChatMessage[];
}

export interface Project {
  _id: string;
  client_id: string;
  client_name?: string;
  title: string;
  description: string;
  category: ProjectCategory;
  skills_required: string[];
  budget_min?: number;
  budget_max?: number;
  location: {
    address: string;
    coordinates: [number, number];
  };
  status: string;
  created_at: string;
  updated_at: string;
  remote_execution?: boolean;
  liberado_por?: string[];
  chat?: ProjectChat[];
  final_budget?: number;
  closed_by?: string;
  closed_by_name?: string;
}

export interface ProjectCreateRequest {
  title: string;
  description: string;
  category: ProjectCategory;
  skills_required?: string[];
  budget_min?: number;
  budget_max?: number;
  location: {
    address: string;
    coordinates: [number, number];
  };
  remote_execution?: boolean;
}

export interface Contact {
  _id: string;
  professional_id: string;
  professional_name?: string;
  project_id: string;
  client_id: string;
  client_name?: string;
  contact_type: string;
  credits_used: number;
  status: string;
  contact_details: {
    message?: string;
    proposal_price?: number;
    [key: string]: any;
  };
  chat: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ContactCreateRequest {
  contact_type: string;
  contact_details: {
    message?: string;
    proposal_price?: number;
    [key: string]: any;
  };
}

export interface ProjectCloseRequest {
  final_budget: number;
  professional_id: string;
}

export interface EvaluationRequest {
  professional_id: string;
  rating: number;
  comment?: string;
}

// Document interfaces
export interface Document {
  _id: string;
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  project_id: string;
  uploaded_by: string;
  validation_status: string; // pending, valid, invalid, error
  validation_result?: {
    status: string;
    documento?: any;
    assinaturas?: any[];
    total_assinaturas?: number;
    error?: string;
  };
  created_at: string;
  updated_at: string;
}

// Contract Template interfaces
export interface ContractTemplate {
  _id: string;
  title: string;
  description?: string;
  template_text: string;
  variables: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContractTemplateImport {
  title: string;
  description?: string;
  template_text: string;
}

export interface GeneratedContract {
  template_id: string;
  template_title: string;
  contract_text: string;
  variables_used: { [key: string]: any };
  generated_at: string;
}

// Payment interfaces
export interface PlanConfig {
  _id: string;
  name: string;
  description: string;
  weekly_credits: number;
  monthly_price: number;
  discount_3_months: number;
  discount_6_months: number;
  discount_12_months: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditPackage {
  _id: string;
  name: string;
  description: string;
  credits: number;
  bonus_credits: number;
  price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FeaturedPricing {
  _id: string;
  duration_days: number;
  price: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentResponse {
  payment_id: string;
  status: string;
  value: number;
  billing_type: string;
  due_date: string;
  invoice_url?: string;
  pix_qrcode?: string;
  pix_payload?: string;
}

export interface SubscriptionStatus {
  has_subscription: boolean;
  status?: string;
  plan_name?: string;
  credits_per_week?: number;
  next_renewal?: string;
  monthly_price?: number;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = getApiUrl()) {
    this.baseUrl = baseUrl;
  }

  async register(userData: UserCreateRequest): Promise<UserResponse> {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao criar conta');
    }

    return response.json();
  }

  async login(credentials: LoginRequest): Promise<TokenResponse> {
    // Se tiver turnstile_token, usar endpoint JSON
    if (credentials.turnstile_token) {
      const response = await fetch(`${this.baseUrl}/auth/login-with-turnstile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.detail || 'Erro ao fazer login');
      }

      return response.json();
    }

    // OAuth2 expects form-data (backward compatibility)
    const formData = new URLSearchParams();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao fazer login');
    }

    return response.json();
  }

  async getCurrentUser(token: string): Promise<UserResponse> {
    const response = await fetch(`${this.baseUrl}/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar dados do usuário');
    }

    return response.json();
  }

  async updateUserRoles(token: string, roles: string[]): Promise<UserResponse> {
    console.log('API - Sending PUT /users/me with roles:', roles);

    const response = await fetch(`${this.baseUrl}/users/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roles }),
    });

    console.log('API - Response status:', response.status);

    if (!response.ok) {
      const error: ApiError = await response.json();
      console.log('API - Error response:', error);
      throw new Error(error.detail || 'Erro ao atualizar roles');
    }

    const userData = await response.json();
    console.log('API - Updated user roles:', userData.roles);
    return userData;
  }

  async updateUserProfile(token: string, profileData: UserProfileUpdate): Promise<UserResponse> {
    console.log('API - Updating user profile:', profileData);

    const response = await fetch(`${this.baseUrl}/users/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao atualizar perfil');
    }

    return response.json();
  }

  // Categories
  async getCategories(token: string): Promise<Category[]> {
    const response = await fetch(`${this.baseUrl}/categories?active_only=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar categorias');
    }

    return response.json();
  }

  // Projects
  async createProject(token: string, projectData: ProjectCreateRequest): Promise<Project> {
    console.log('Creating project:', projectData);
    const response = await fetch(`${this.baseUrl}/projects/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });

    console.log('Create project response status:', response.status);

    if (!response.ok) {
      const error: ApiError = await response.json();
      console.error('Create project error:', error);
      throw new Error(error.detail || 'Erro ao criar projeto');
    }

    const project = await response.json();
    console.log('Project created successfully:', project);
    return project;
  }

  async getMyProjects(token: string): Promise<Project[]> {
    // First get current user to get their ID
    const user = await this.getCurrentUser(token);

    // Then fetch all projects and filter by client_id on frontend
    // (API doesn't have a my-projects endpoint, so we need to filter all projects)
    const response = await fetch(`${this.baseUrl}/projects?limit=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar projetos');
    }

    const allProjects: Project[] = await response.json();
    // Filter to only return projects created by this user
    return allProjects.filter(project => project.client_id === user._id);
  }

  async getProjectById(token: string, projectId: string): Promise<Project> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar projeto');
    }

    return response.json();
  }

  async getNearbyProjects(
    token: string,
    latitude: number,
    longitude: number,
    radiusKm: number = 10
  ): Promise<Project[]> {
    const response = await fetch(
      `${this.baseUrl}/projects/nearby?latitude=${latitude}&longitude=${longitude}&radius_km=${radiusKm}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar projetos próximos');
    }

    return response.json();
  }

  // Contacts - Liberação de projetos
  async createContact(token: string, projectId: string, contactData: ContactCreateRequest): Promise<Contact> {
    const response = await fetch(`${this.baseUrl}/contacts/${projectId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao liberar projeto');
    }

    return response.json();
  }

  async getContactHistory(token: string, userType: string = 'professional'): Promise<Contact[]> {
    const response = await fetch(`${this.baseUrl}/contacts/history?user_type=${userType}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar histórico de contatos');
    }

    return response.json();
  }

  async updateContactStatus(token: string, contactId: string, status: string): Promise<Contact> {
    const response = await fetch(`${this.baseUrl}/contacts/${contactId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao atualizar status do contato');
    }

    return response.json();
  }

  // Project Close and Evaluation
  async closeProject(token: string, projectId: string, closeData: ProjectCloseRequest): Promise<{ message: string; project_id: string }> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/close`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(closeData),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao finalizar projeto');
    }

    return response.json();
  }

  async evaluateProfessional(token: string, projectId: string, evaluation: EvaluationRequest): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/evaluate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(evaluation),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao avaliar profissional');
    }

    return response.json();
  }

  // Contract Templates
  async getContractTemplates(token: string, myTemplates: boolean = false): Promise<ContractTemplate[]> {
    const url = myTemplates
      ? `${this.baseUrl}/contract-templates/?my_templates=true`
      : `${this.baseUrl}/contract-templates/`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar templates');
    }

    return response.json();
  }

  async getContractTemplate(token: string, templateId: string): Promise<ContractTemplate> {
    const response = await fetch(`${this.baseUrl}/contract-templates/${templateId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar template');
    }

    return response.json();
  }

  async generateContractForProject(
    token: string,
    projectId: string,
    templateId: string,
    professionalId: string
  ): Promise<GeneratedContract> {
    const response = await fetch(
      `${this.baseUrl}/contract-templates/generate-for-project/${projectId}?template_id=${templateId}&professional_id=${professionalId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao gerar contrato');
    }

    return response.json();
  }

  // Documents
  async uploadDocument(token: string, projectId: string, file: File): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/documents/upload/${projectId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao fazer upload do documento');
    }

    return response.json();
  }

  async getProjectDocuments(token: string, projectId: string): Promise<Document[]> {
    const response = await fetch(`${this.baseUrl}/documents/project/${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar documentos');
    }

    return response.json();
  }

  async getDocument(token: string, documentId: string): Promise<Document> {
    const response = await fetch(`${this.baseUrl}/documents/${documentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar documento');
    }

    return response.json();
  }

  getDocumentDownloadUrl(token: string, documentId: string): string {
    return `${this.baseUrl}/documents/${documentId}/download?token=${token}`;
  }

  // Payments - Plans
  async getPlans(token: string): Promise<PlanConfig[]> {
    const response = await fetch(`${this.baseUrl}/api/payments/plans`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar planos');
    }

    return response.json();
  }

  async getSubscriptionStatus(token: string): Promise<SubscriptionStatus> {
    const response = await fetch(`${this.baseUrl}/api/payments/subscription/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar status da assinatura');
    }

    return response.json();
  }

  async createSubscriptionPayment(
    token: string,
    planId: string,
    billingType: string,
    cycleMonths: number = 1
  ): Promise<PaymentResponse> {
    const response = await fetch(`${this.baseUrl}/api/payments/subscription`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: planId,
        billing_type: billingType,
        cycle_months: cycleMonths,
      }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao criar pagamento de assinatura');
    }

    return response.json();
  }

  async cancelSubscription(token: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/payments/subscription/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao cancelar assinatura');
    }

    return response.json();
  }

  // Payments - Credits
  async getCreditPackages(token: string): Promise<CreditPackage[]> {
    const response = await fetch(`${this.baseUrl}/api/payments/credit-packages`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar pacotes de créditos');
    }

    return response.json();
  }

  async createCreditPackagePayment(
    token: string,
    packageId: string,
    billingType: string
  ): Promise<PaymentResponse> {
    const response = await fetch(`${this.baseUrl}/api/payments/credits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package_id: packageId,
        billing_type: billingType,
      }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao criar pagamento de créditos');
    }

    return response.json();
  }

  // Payments - Featured Projects
  async getFeaturedPricing(token: string): Promise<FeaturedPricing[]> {
    const response = await fetch(`${this.baseUrl}/api/payments/featured-pricing`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar preços de destaque');
    }

    return response.json();
  }

  async createFeaturedProjectPayment(
    token: string,
    projectId: string,
    durationDays: number,
    billingType: string
  ): Promise<PaymentResponse> {
    const response = await fetch(`${this.baseUrl}/api/payments/featured-project`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: projectId,
        duration_days: durationDays,
        billing_type: billingType,
      }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao criar pagamento de projeto destacado');
    }

    return response.json();
  }

  // Payments - Status and Test
  async getPaymentStatus(token: string, paymentId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/payments/status/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar status do pagamento');
    }

    return response.json();
  }

  async testPayment(externalReference: string, value: number): Promise<any> {
    const response = await fetch(`${this.baseUrl}/webhooks/test-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_reference: externalReference,
        value: value,
      }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao processar pagamento de teste');
    }

    return response.json();
  }

  // Support (SAC) Methods
  async createSupportTicket(token: string, ticketData: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/support/tickets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ticketData),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao criar ticket');
    }

    return response.json();
  }

  async getMyTickets(token: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/support/tickets/my`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar tickets');
    }

    return response.json();
  }

  async getTicket(token: string, ticketId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/support/tickets/${ticketId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar ticket');
    }

    return response.json();
  }

  async addMessageToTicket(
    token: string,
    ticketId: string,
    messageData: { message: string; attachments: string[] }
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao enviar mensagem');
    }

    return response.json();
  }

  async rateTicket(
    token: string,
    ticketId: string,
    rating: number,
    comment?: string
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/support/tickets/${ticketId}/rate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rating,
        comment: comment || null,
      }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao avaliar ticket');
    }

    return response.json();
  }
}

export const apiService = new ApiService();
