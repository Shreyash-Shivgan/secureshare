/**
 * SecureShare – Register Page
 * Generates RSA-2048 key pair on registration and stores private key locally.
 */

import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import {
    generateRSAKeyPair,
    exportPublicKey,
    exportPrivateKey,
} from "../utils/crypto";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [keyStatus, setKeyStatus] = useState("");
    const navigate = useNavigate();
    const { setAuth } = useAuth();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        setLoading(true);

        try {
            // Step 1: Generate RSA key pair in the browser
            setKeyStatus("Generating RSA-2048 key pair...");
            const keyPair = await generateRSAKeyPair();

            // Step 2: Export keys
            setKeyStatus("Exporting keys...");
            const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
            const privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);

            // Step 3: Register with server (sends public key only)
            setKeyStatus("Creating account...");
            const res = await api.register(email, password, publicKeyBase64);

            // Step 4: Store private key PER USER ID (NEVER sent to server)
            localStorage.setItem(`privateKey_${res.user_id}`, privateKeyBase64);

            setAuth(res.access_token, res.user_id, res.email);
            navigate("/dashboard");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
            setKeyStatus("");
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="logo">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                            <rect width="40" height="40" rx="12" fill="url(#grad2)" />
                            <path
                                d="M20 10L28 16V24L20 30L12 24V16L20 10Z"
                                stroke="white"
                                strokeWidth="2"
                                fill="none"
                            />
                            <circle cx="20" cy="20" r="4" fill="white" />
                            <defs>
                                <linearGradient
                                    id="grad2"
                                    x1="0"
                                    y1="0"
                                    x2="40"
                                    y2="40"
                                >
                                    <stop stopColor="#6366f1" />
                                    <stop offset="1" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h1>Create Account</h1>
                    <p className="subtitle">
                        Your RSA keys will be generated automatically
                    </p>
                </div>

                {error && <div className="error-banner">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="reg-email">Email</label>
                        <input
                            id="reg-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="reg-password">Password</label>
                        <input
                            id="reg-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 8 characters"
                            required
                            minLength={8}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="reg-confirm">Confirm Password</label>
                        <input
                            id="reg-confirm"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            required
                        />
                    </div>

                    {keyStatus && (
                        <div className="key-generating">
                            <span className="spinner" /> {keyStatus}
                        </div>
                    )}

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? <span className="spinner" /> : "Create Account"}
                    </button>
                </form>

                <div className="security-notice">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a4 4 0 00-4 4v2H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5z" />
                    </svg>
                    <span>
                        Your private key stays in your browser and is{" "}
                        <strong>never sent to the server</strong>.
                    </span>
                </div>

                <p className="auth-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
