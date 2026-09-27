import { useCallback, useEffect, useMemo, useState } from 'react';

import { authApi } from '../services/authApi.js';
import { AuthContext } from './authContext.js';

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });

  const refreshSession = useCallback(async () => {
    try {
      const response = await authApi.getSession();
      setState({ status: 'authenticated', user: response.data.user });
      return response.data.user;
    } catch {
      setState({ status: 'guest', user: null });
      return null;
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    authApi
      .getSession()
      .then((response) => {
        if (isActive) {
          setState({ status: 'authenticated', user: response.data.user });
        }
      })
      .catch(() => {
        if (isActive) setState({ status: 'guest', user: null });
      });

    return () => {
      isActive = false;
    };
  }, []);

  const register = useCallback(async (credentials) => {
    const response = await authApi.register(credentials);
    setState({ status: 'authenticated', user: response.data.user });
    return response.data.user;
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await authApi.login(credentials);
    setState({ status: 'authenticated', user: response.data.user });
    return response.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setState({ status: 'guest', user: null });
    }
  }, []);

  const value = useMemo(
    () => ({
      status: state.status,
      user: state.user,
      isAuthenticated: state.status === 'authenticated',
      isLoading: state.status === 'loading',
      login,
      logout,
      refreshSession,
      register,
    }),
    [login, logout, refreshSession, register, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
