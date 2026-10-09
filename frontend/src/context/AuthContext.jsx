import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
const API = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('synco_token');
    const savedUser  = localStorage.getItem('synco_user');
    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } catch {
        localStorage.removeItem('synco_token');
        localStorage.removeItem('synco_user');
      }
    }
    setLoading(false);
  }, []);

  const saveSession = (token, user) => {
    localStorage.setItem('synco_token', token);
    localStorage.setItem('synco_user', JSON.stringify(user));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
  };

  const signup = async (displayName, username, email, password) => {
    const res = await axios.post(`${API}/auth/signup`, { displayName, username, email, password });
    saveSession(res.data.token, res.data.user);
    return res.data;
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    saveSession(res.data.token, res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('synco_token');
    localStorage.removeItem('synco_user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // Re-fetch the profile (after edits) and keep stored session in sync.
  const refreshMe = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      const token = localStorage.getItem('synco_token');
      if (token && res.data) {
        const sessionUser = {
          id: res.data._id, displayName: res.data.displayName,
          username: res.data.username, email: res.data.email,
          avatarColor: res.data.avatarColor
        };
        localStorage.setItem('synco_user', JSON.stringify(sessionUser));
        setUser(sessionUser);
      }
      return res.data;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
