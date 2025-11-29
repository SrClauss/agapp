import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import * as SecureStore from 'expo-secure-store';

// Get base URL from environment
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Configure retry logic
axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: AxiosError) => {
    // Retry on network errors or 5xx server errors
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response?.status ? error.response.status >= 500 : false)
    );
  },
});

// Request interceptor - add auth token
client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Get token from secure store
      const token = await SecureStore.getItemAsync('auth_token');

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
client.interceptors.response.use(
  (response) => {
    // Return successful response
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // TODO: Implement token refresh logic here if you have a refresh endpoint
        // For now, just clear the token and let the user re-authenticate
        await SecureStore.deleteItemAsync('auth_token');

        // You could also trigger a navigation to login screen here
        // or emit an event that the app listens to
      } catch (refreshError) {
        console.error('Error handling 401:', refreshError);
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
