export function getRouteForRoles(roles: string[] | undefined | null, activeRole?: string | null) {
  // Se tiver um activeRole salvo, use ele
  if (activeRole) {
    if (activeRole === 'client') return 'WelcomeCustomer';
    if (activeRole === 'professional') return 'WelcomeProfessional';
  }

  if (!roles || roles.length === 0) return 'ProfileSelection';

  const isClient = roles.includes('client');
  const isProfessional = roles.includes('professional');

  if (isClient && isProfessional) return 'ProfileSelection';
  if (isProfessional) return 'WelcomeProfessional';
  return 'WelcomeCustomer';
}

export default getRouteForRoles;
