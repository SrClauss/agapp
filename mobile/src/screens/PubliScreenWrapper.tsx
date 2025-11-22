import React, { useState } from 'react';
import PubliScreen from './PubliScreen';
import ClientHomeScreen from './ClientHomeScreen';
import ProfessionalHomeScreen from './ProfessionalHomeScreen';
import useAuthStore from '../stores/authStore';

export default function PubliScreenWrapper() {
  const [showPubliScreen, setShowPubliScreen] = useState(true);
  const activeRole = useAuthStore((state) => state.activeRole);

  const handleClosePubliScreen = () => {
    setShowPubliScreen(false);
  };

  if (showPubliScreen) {
    const location = activeRole === 'client'
      ? 'publi_screen_client'
      : 'publi_screen_professional';

    return (
      <PubliScreen
        location={location}
        onClose={handleClosePubliScreen}
      />
    );
  }

  // Show the appropriate home screen based on role
  if (activeRole === 'client') {
    return <ClientHomeScreen />;
  } else {
    return <ProfessionalHomeScreen />;
  }
}
