"""
Stacks predefinidas para navegação de ads por target.
Impede que ads de cliente naveguem para stacks de profissional e vice-versa.
"""

# Stacks disponíveis para clientes
CLIENT_STACKS = {
    "WelcomeCustomer": "Tela de boas-vindas do cliente",
    "SearchResults": "Resultados de busca",
    "CreateProject": "Criar novo projeto",
    "AllProjects": "Todos os projetos",
    "Support": "Suporte",
}

# Stacks disponíveis para profissionais
PROFESSIONAL_STACKS = {
    "WelcomeProfessional": "Tela de boas-vindas do profissional",
    "ProjectsList": "Lista de projetos disponíveis",
    "Credits": "Meus créditos",
    "CreditPackages": "Comprar créditos",
    "Subscriptions": "Assinaturas",
    "Support": "Suporte",
}


def get_stacks_for_target(target: str) -> dict:
    """
    Retorna as stacks disponíveis para um target específico.
    
    Args:
        target: 'client' ou 'professional'
    
    Returns:
        Dicionário com stack_name -> description
    """
    if target == "client":
        return CLIENT_STACKS
    elif target == "professional":
        return PROFESSIONAL_STACKS
    return {}


def validate_stack_for_target(target: str, stack_name: str) -> bool:
    """
    Valida se uma stack é permitida para um target específico.
    
    Args:
        target: 'client' ou 'professional'
        stack_name: Nome da stack a ser validada
    
    Returns:
        True se a stack é válida para o target, False caso contrário
    """
    stacks = get_stacks_for_target(target)
    return stack_name in stacks


def get_welcome_stack_for_target(target: str) -> str:
    """
    Retorna a stack de boas-vindas para um target específico.
    
    Args:
        target: 'client' ou 'professional'
    
    Returns:
        Nome da stack de boas-vindas
    """
    if target == "client":
        return "WelcomeCustomer"
    elif target == "professional":
        return "WelcomeProfessional"
    return "WelcomeCustomer"
