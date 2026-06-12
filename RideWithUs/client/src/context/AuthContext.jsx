import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authAPI } from "../services/api";
import socketService from "../services/socket";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("rwu_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("rwu_user");
    const savedToken = localStorage.getItem("rwu_token");
    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
        socketService.connect(savedToken);
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback((userData, jwt) => {
    localStorage.setItem("rwu_token", jwt);
    localStorage.setItem("rwu_user", JSON.stringify(userData));
    setToken(jwt);
    setUser(userData);
    socketService.connect(jwt);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("rwu_token");
    localStorage.removeItem("rwu_user");
    setToken(null);
    setUser(null);
    socketService.disconnect();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authAPI.getMe();
      setUser(data.user);
      localStorage.setItem("rwu_user", JSON.stringify(data.user));
    } catch {
      logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isLoggedIn: !!user,
        isAdmin: user?.role === "admin",
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
