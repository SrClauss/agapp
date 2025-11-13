// API Configuration
// Available backend endpoints
export const API_ENDPOINTS = {
  CLOUD: 'https://agilizapro.cloud',
  NET: 'https://agilizapro.net',
} as const;

// Default endpoint - change this to switch between backends
export const DEFAULT_API_ENDPOINT = API_ENDPOINTS.CLOUD;

// Environment-based configuration (can be extended later)
export const getApiUrl = (): string => {
  // You can add logic here to determine which endpoint to use
  // For example, based on environment variables or user settings
  return DEFAULT_API_ENDPOINT;
};
