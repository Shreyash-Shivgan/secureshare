/**
 * SecureShare – Login Page
 */

import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import { importPrivateKey } from "../utils/crypto";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [privateKeyInput, setPrivateKeyInput] = useState("");
    const [showKeyInput, setShowKeyInput] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setAuth } = useAuth();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // Step 1: Login to get user_id
            const res = await api.login(email, password);

            // Step 2: Look up private key: per-user → pasted → legacy
            const perUserKey = localStorage.getItem(`privateKey_${res.user_id}`);
            const pastedKey = privateKeyInput.trim();
            const legacyKey = localStorage.getItem("privateKey");
            const keyToUse = perUserKey || pastedKey || legacyKey;

            if (!keyToUse) {
                setShowKeyInput(true);
                throw new Error(
                    "No private key found for this account. Please paste your private key below, or register a new account."
                );
            }

            // Step 3: Validate the key
            await importPrivateKey(keyToUse);

            // Step 4: Store under per-user key
            localStorage.setItem(`privateKey_${res.user_id}`, keyToUse);

            setAuth(res.access_token, res.user_id, res.email);
            navigate("/dashboard");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="logo">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                            <rect width="40" height="40" rx="12" fill="url(#grad)" />
                            <path
                                d="M20 10L28 16V24L20 30L12 24V16L20 10Z"
                                stroke="white"
                                strokeWidth="2"
                                fill="none"
                            />
                            <circle cx="20" cy="20" r="4" fill="white" />
                            <defs>
                                <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40">
                                    <stop stopColor="#6366f1" />
                                    <stop offset="1" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h1>Welcome Back</h1>
                    <p className="subtitle">Sign in to SecureShare</p>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {showKeyInput && (
                        <div className="form-group">
                            <label htmlFor="privateKey">
                                Private Key{" "}
                                <span className="label-hint">
                                    (paste the key you exported during registration)
                                </span>
                            </label>
                            <textarea
                                id="privateKey"
                                value={privateKeyInput}
                                onChange={(e) => setPrivateKeyInput(e.target.value)}
                                placeholder="Paste your base64 private key here..."
                                rows={3}
                            />
                        </div>
                    )}

                    {!showKeyInput && (
                        <button
                            type="button"
                            className="btn-ghost"
                            style={{ width: "100%", marginBottom: "0.75rem", fontSize: "0.8rem" }}
                            onClick={() => setShowKeyInput(true)}
                        >
                            🔑 Import private key from backup
                        </button>
                    )}

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? <span className="spinner" /> : "Sign In"}
                    </button>
                </form>

                <p className="auth-footer">
                    Don't have an account? <Link to="/register">Create one</Link>
                </p>
            </div>
        </div>
    );
}
