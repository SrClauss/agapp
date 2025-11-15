import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar } from 'react-native-paper';
import { colors } from '../theme';

interface SnackbarContextData {
  showSnackbar: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideSnackbar: () => void;
}

const SnackbarContext = createContext<SnackbarContextData>({} as SnackbarContextData);

export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'success' | 'error' | 'info'>('info');

  const showSnackbar = useCallback((msg: string, snackbarType: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setType(snackbarType);
    setVisible(true);
  }, []);

  const hideSnackbar = useCallback(() => {
    setVisible(false);
  }, []);

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
      case 'info':
      default:
        return colors.primary;
    }
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar, hideSnackbar }}>
      {children}
      <Snackbar
        visible={visible}
        onDismiss={hideSnackbar}
        duration={3000}
        action={{
          label: 'OK',
          onPress: hideSnackbar,
        }}
        style={{ backgroundColor: getBackgroundColor() }}
      >
        {message}
      </Snackbar>
    </SnackbarContext.Provider>
  );
};

export const useSnackbar = (): SnackbarContextData => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
};
