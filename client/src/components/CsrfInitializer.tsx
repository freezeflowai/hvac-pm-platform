// client/src/components/CsrfInitializer.tsx

import { useEffect } from 'react';
import { initCSRF } from '../lib/queryClient';

/**
 * Initializes CSRF token when the app loads
 * Place this component in your App.tsx inside QueryClientProvider
 */
export function CsrfInitializer() {
  useEffect(() => {
    initCSRF().catch((error) => {
      console.error('[App] Failed to initialize CSRF token:', error);
      // You might want to show an error UI here or redirect to login
    });
  }, []);

  return null; // This component doesn't render anything
}