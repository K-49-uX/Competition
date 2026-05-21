/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, configureApi } from '../api/client.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('afya.token'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('afya.user') || 'null'); }
    catch { return null; }
  });
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem('afya.token');
    localStorage.removeItem('afya.user');
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    configureApi({
      getToken: () => token,
      onUnauthorized: () => logout(),
    });
  }, [token, logout]);

  useEffect(() => {
    if (!token) return;
    api.get('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
        localStorage.setItem('afya.user', JSON.stringify(data.user));
      })
      .catch(() => {});
  }, [token]);

  const persist = useCallback((data) => {
    localStorage.setItem('afya.token', data.token);
    localStorage.setItem('afya.user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(async ({ identifier, password }) => {
    // Transient failures (cold backend, dropped socket on first request after a
    // dev-server restart, brief network hiccup) used to surface as a generic
    // "something went wrong" toast and force the user to click Login a second
    // time. We now retry once automatically when the failure looks transient
    // (no response, network error, 502/503/504, or AbortError) so a valid
    // credential set succeeds on the first user-visible attempt.
    const isTransient = (err) => {
      if (!err) return false;
      if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') return true;
      if (!err.response) return true; // no response = network-level failure
      const s = err.response.status;
      return s === 0 || s === 502 || s === 503 || s === 504;
    };
    const attempt = () => api.post('/auth/login', { identifier, password });
    let data;
    try {
      ({ data } = await attempt());
    } catch (err) {
      if (!isTransient(err)) throw err;
      // brief backoff lets a just-restarted nodemon worker finish booting
      await new Promise((r) => setTimeout(r, 350));
      ({ data } = await attempt());
    }
    return persist(data);
  }, [persist]);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return persist(data);
  }, [persist]);

  const forgotPassword = useCallback(async (identifier) => {
    const { data } = await api.post('/auth/forgot-password', { identifier });
    return data; // { ok: true, devResetToken? }
  }, []);

  const resetPassword = useCallback(async ({ token: rt, password }) => {
    const { data } = await api.post('/auth/reset-password', { token: rt, password });
    return persist(data);
  }, [persist]);

  // Phase 6.2 — OTP login. Two helpers so the LoginOtp page doesn't have
  // to know about token persistence.
  const requestOtp = useCallback(async (phone) => {
    const { data } = await api.post('/auth/otp/request', { phone });
    return data; // { ok: true, devOtp? }
  }, []);
  const verifyOtp = useCallback(async ({ phone, code }) => {
    const { data } = await api.post('/auth/otp/verify', { phone, code });
    return persist(data);
  }, [persist]);

  const value = useMemo(
    () => ({ user, token, login, register, logout, setUser, forgotPassword, resetPassword, requestOtp, verifyOtp, setSession: persist }),
    [user, token, login, register, logout, forgotPassword, resetPassword, requestOtp, verifyOtp, persist]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
