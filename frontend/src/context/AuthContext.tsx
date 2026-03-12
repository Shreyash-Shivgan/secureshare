/**
 * SecureShare – Authentication Context
 * Manages JWT token, user info, and RSA private key in localStorage.
 */

import {
    createContext,
    useContext,
    useState,
    useEffect,
    type ReactNode,
} from "react";

interface AuthState {
    token: string | null;
    userId: number | null;
    email: string | null;
}

interface AuthContextType extends AuthState {
    setAuth: (token: string, userId: number, email: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [auth, setAuthState] = useState<AuthState>({
        token: localStorage.getItem("token"),
        userId: localStorage.getItem("userId")
            ? Number(localStorage.getItem("userId"))
            : null,
        email: localStorage.getItem("email"),
    });

    const setAuth = (token: string, userId: number, email: string) => {
        localStorage.setItem("token", token);
        localStorage.setItem("userId", userId.toString());
        localStorage.setItem("email", email);
        setAuthState({ token, userId, email });
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("email");
        // Keep RSA keys — they are tied to the user's registration
        setAuthState({ token: null, userId: null, email: null });
    };

    return (
        <AuthContext.Provider
            value={{
                ...auth,
                setAuth,
                logout,
                isAuthenticated: !!auth.token,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
