// Valid navigation targets for banners, grouped by user type.
// These string values must correspond to route names used in the app's
// navigation stack. Keep in sync with the admin UI mapping.

export const stacksByTarget: Record<'client' | 'professional', string[]> = {
  client: [
    'servicosProximos',
    'assinatura',
    'compraCreditos',
    'buyFeaturedProjects',
  ],
  professional: [
    'assinarPlano',
    'compraCreditos',
    'meusServicos',
  ],
};
