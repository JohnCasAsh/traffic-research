import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { API_URL, buildAuthHeaders } from './api';

const AUTH_TOKEN_STORAGE_KEY = 'authToken';
const AUTH_USER_STORAGE_KEY = 'user';

export type UserAddress = {
  country: string;
  province: string;
  city: string;
  barangay: string;
  street: string;
  houseNumber: string;
  postalCode: string;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  profilePictureUrl: string;
  address: UserAddress;
  authProviders: string[];
  hasPassword: boolean;
  emailVerified: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function createEmptyAddress(): UserAddress {
  return {
    country: '',
    province: '',
    city: '',
    barangay: '',
    street: '',
    houseNumber: '',
    postalCode: '',
  };
}

function normalizeAddress(address: Partial<UserAddress> | null | undefined): UserAddress {
  return {
    country: typeof address?.country === 'string' ? address.country : '',
    province: typeof address?.province === 'string' ? address.province : '',
    city: typeof address?.city === 'string' ? address.city : '',
    barangay: typeof address?.barangay === 'string' ? address.barangay : '',
    street: typeof address?.street === 'string' ? address.street : '',
    houseNumber: typeof address?.houseNumber === 'string' ? address.houseNumber : '',
    postalCode: typeof address?.postalCode === 'string' ? address.postalCode : '',
  };
}

function normalizeUser(user: Partial<AuthUser> | null | undefined): AuthUser | null {
  if (!user?.id) {
    return null;
  }

  return {
    id: String(user.id),
    email: typeof user.email === 'string' ? user.email : '',
    firstName: typeof user.firstName === 'string' ? user.firstName : '',
    lastName: typeof user.lastName === 'string' ? user.lastName : '',
    role: typeof user.role === 'string' ? user.role : 'driver',
    profilePictureUrl:
      typeof user.profilePictureUrl === 'string' ? user.profilePictureUrl : '',
    address: normalizeAddress(user.address),
    authProviders: Array.isArray(user.authProviders)
      ? user.authProviders.map((provider) => String(provider)).filter(Boolean)
      : [],
    hasPassword: Boolean(user.hasPassword),
    emailVerified: user.emailVerified !== false,
  };
}

function readStoredUser() {
  const rawUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return normalizeUser(JSON.parse(rawUser));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [isInitializing, setIsInitializing] = useState(Boolean(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)));

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setIsInitializing(false);
  }, []);

  const updateUser = useCallback((nextUser: AuthUser) => {
    const normalizedUser = normalizeUser(nextUser);
    if (!normalizedUser) {
      return;
    }

    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(normalizedUser));
    setUser(normalizedUser);
  }, []);

  const login = useCallback((nextToken: string, nextUser: AuthUser) => {
    const normalizedUser = normalizeUser(nextUser);
    if (!normalizedUser) {
      throw new Error('Invalid user payload');
    }

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextToken);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(normalizedUser));
    setToken(nextToken);
    setUser(normalizedUser);
    setIsInitializing(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    const activeToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!activeToken) {
      setIsInitializing(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: buildAuthHeaders(activeToken),
      });

      if (response.status === 403) {
        logout();
        window.location.replace('/login?suspended=1');
        return;
      }

      if (!response.ok) {
        throw new Error('Unable to refresh session');
      }

      const payload = await response.json();
      const normalizedUser = normalizeUser(payload?.user);
      if (!normalizedUser) {
        throw new Error('Invalid profile payload');
      }

      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(normalizedUser));
      setToken(activeToken);
      setUser(normalizedUser);
    } catch {
      logout();
      return;
    }

    setIsInitializing(false);
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setIsInitializing(false);
      return;
    }

    refreshProfile();
  }, [token, refreshProfile]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(refreshProfile, 30_000);
    return () => clearInterval(interval);
  }, [token, refreshProfile]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== AUTH_TOKEN_STORAGE_KEY &&
        event.key !== AUTH_USER_STORAGE_KEY &&
        event.key !== null
      ) {
        return;
      }

      const nextToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      const nextUser = readStoredUser();
      setToken(nextToken);
      setUser(nextUser);
      setIsInitializing(Boolean(nextToken));
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isInitializing,
    login,
    logout,
    refreshProfile,
    updateUser,
  }), [isInitializing, login, logout, refreshProfile, token, updateUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export { createEmptyAddress };