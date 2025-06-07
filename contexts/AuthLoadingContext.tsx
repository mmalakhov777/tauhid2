'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthLoadingContextType {
  isAuthLoading: boolean;
  setIsAuthLoading: (loading: boolean) => void;
}

const AuthLoadingContext = createContext<AuthLoadingContextType | undefined>(undefined);

export function AuthLoadingProvider({ children }: { children: ReactNode }) {
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  return (
    <AuthLoadingContext.Provider value={{ isAuthLoading, setIsAuthLoading }}>
      {children}
    </AuthLoadingContext.Provider>
  );
}

export function useAuthLoading() {
  const context = useContext(AuthLoadingContext);
  if (context === undefined) {
    throw new Error('useAuthLoading must be used within an AuthLoadingProvider');
  }
  return context;
} 