import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { unsubscribeFromPush } from '../utils/pushHelper';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 페이지 로드 시 토큰으로 사용자 정보 가져오기
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await api.getCurrentUser();
          setUser(userData.user);
        } catch (error) {
          console.error('Auth init failed:', error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (userData) => {
    const data = await api.register(userData);
    // 관리자 승인 필요 - 자동 로그인하지 않음
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await unsubscribeFromPush(); } catch (e) { /* ignore */ }
    await api.logout();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (profileData) => {
    const data = await api.updateMyProfile(profileData);
    setUser(data.user);
    return data;
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  }), [user, loading, login, register, logout, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
