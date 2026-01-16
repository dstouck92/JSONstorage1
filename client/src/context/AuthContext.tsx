import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  avatar: string;
  hasPassword?: boolean;
  spotifyConnected?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password?: string) => Promise<{ success: boolean; error?: string; needsPassword?: boolean }>;
  signup: (username: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      setUser(data.user);
    } catch (e) {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password?: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === 'Password required') {
          return { success: false, needsPassword: true };
        }
        return { success: false, error: data.error };
      }
      
      setUser(data.user);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  };

  const signup = async (username: string, password?: string) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        return { success: false, error: data.error };
      }
      
      setUser(data.user);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    setUser(null);
  };

  const setPassword = async (password: string) => {
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        return { success: false, error: data.error };
      }
      
      await refreshUser();
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, setPassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
