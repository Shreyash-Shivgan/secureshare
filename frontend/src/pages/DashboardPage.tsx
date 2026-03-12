/**
 * SecureShare – Dashboard Page
 * Upload encrypted files, view file list, download & decrypt files.
 */

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import {
    generateAESKey,
    encryptFile,
    wrapAESKey,
    importPublicKey,
    importPrivateKey,
    unwrapAESKey,
    decryptFile,
    packEncryptedFile,
    unpackEncryptedFile,
} from "../utils/crypto";

export default function DashboardPage() {
    const { email, userId, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [users, setUsers] = useState<api.UserInfo[]>([]);
    const [files, setFiles] = useState<api.FileInfo[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [recipientId, setRecipientId] = useState<number | "">("");
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState("");
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [activeTab, setActiveTab] = useState<"upload" | "files" | "keys">("files");
    const [publicKey, setPublicKey] = useState<string>("");
    const [copied, setCopied] = useState<string>("");

    const loadData = useCallback(async () => {
        try {
            const [usersData, filesData] = await Promise.all([
                api.fetchUsers(),
                api.fetchFiles(),
            ]);
            setUsers(usersData);
            setFiles(filesData);

            // Fetch current user's public key from the /me endpoint or users list
            // We'll use a dedicated endpoint
            try {
                const meRes = await fetch("http://localhost:8000/me", {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                });
                if (meRes.ok) {
                    const meData = await meRes.json();
                    setPublicKey(meData.public_key || "");
                }
            } catch { /* ignore */ }
        } catch {
            setError("Failed to load data. Please try again.");
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate("/login");
            return;
        }
        loadData();
    }, [isAuthenticated, navigate, loadData]);

    // ── Upload Handler ──────────────────────────────────────────────────────

    const handleUpload = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!selectedFile || !recipientId) {
            setError("Please select a file and recipient");
            return;
        }

        const recipient = users.find((u) => u.id === recipientId);
        if (!recipient) {
            setError("Recipient not found");
            return;
        }

        setUploading(true);

        try {
            // 1. Read file as ArrayBuffer
            setUploadStatus("Reading file...");
            const fileData = await selectedFile.arrayBuffer();

            // 2. Generate random AES-256 key
            setUploadStatus("Generating AES-256 key...");
            const aesKey = await generateAESKey();

            // 3. Encrypt file with AES-GCM
            setUploadStatus("Encrypting file (AES-256-GCM)...");
            const encrypted = await encryptFile(aesKey, fileData);

            // 4. Import recipient's RSA public key
            setUploadStatus("Wrapping key with RSA-OAEP...");
            const rsaPubKey = await importPublicKey(recipient.public_key);

            // 5. Wrap AES key with recipient's RSA public key
            const wrappedKey = await wrapAESKey(aesKey, rsaPubKey);

            // 6. Pack IV + ciphertext into a single blob
            const encryptedBlob = packEncryptedFile(encrypted);

            // 7. Upload to backend
            setUploadStatus("Uploading encrypted file...");
            await api.uploadFile(
                encryptedBlob,
                wrappedKey,
                recipientId as number,
                selectedFile.name
            );

            setSuccess(
                `File "${selectedFile.name}" encrypted and sent to ${recipient.email}!`
            );
            setSelectedFile(null);
            setRecipientId("");
            setActiveTab("files");
            loadData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
            setUploadStatus("");
        }
    };

    // ── Download Handler ────────────────────────────────────────────────────

    const handleDownload = async (fileInfo: api.FileInfo) => {
        setError("");
        setSuccess("");
        setDownloadingId(fileInfo.id);

        try {
            // 1. Download encrypted file from server
            const { data } = await api.downloadFile(fileInfo.id);

            // 2. Get the encrypted AES key from the file list data (already loaded)
            const encryptedKey = fileInfo.encrypted_key;
            if (!encryptedKey) {
                throw new Error("Encrypted key not found for this file.");
            }

            // 3. Import user's RSA private key from localStorage (per-user key)
            const privateKeyBase64 =
                localStorage.getItem(`privateKey_${userId}`) ||
                localStorage.getItem("privateKey");  // legacy fallback
            if (!privateKeyBase64) {
                throw new Error(
                    "Private key not found for your account. " +
                    "Please re-register or paste your private key on the login page."
                );
            }
            const rsaPrivateKey = await importPrivateKey(privateKeyBase64);

            // 4. Unwrap AES key with RSA private key
            const aesKey = await unwrapAESKey(encryptedKey, rsaPrivateKey);

            // 5. Unpack IV + ciphertext
            const { iv, ciphertext } = unpackEncryptedFile(data);

            // 6. Decrypt file with AES key
            const decrypted = await decryptFile(aesKey, iv, ciphertext);

            // 7. Trigger browser download of decrypted file
            const blob = new Blob([decrypted]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileInfo.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setSuccess(`File "${fileInfo.filename}" decrypted and downloaded!`);
        } catch (err: any) {
            setError(`Decryption failed: ${err.message}`);
        } finally {
            setDownloadingId(null);
        }
    };

    // ── Handle Logout ───────────────────────────────────────────────────────

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // ── Get file icon based on extension ────────────────────────────────────

    const getFileIcon = (filename: string) => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const icons: Record<string, string> = {
            pdf: "📄",
            doc: "📝",
            docx: "📝",
            txt: "📃",
            png: "🖼️",
            jpg: "🖼️",
            jpeg: "🖼️",
            gif: "🖼️",
            mp4: "🎬",
            mp3: "🎵",
            zip: "📦",
            rar: "📦",
        };
        return icons[ext] || "📎";
    };

    return (
        <div className="dashboard-container">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <header className="dashboard-header">
                <div className="header-left">
                    <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                        <rect width="40" height="40" rx="12" fill="url(#gradH)" />
                        <path
                            d="M20 10L28 16V24L20 30L12 24V16L20 10Z"
                            stroke="white"
                            strokeWidth="2"
                            fill="none"
                        />
                        <circle cx="20" cy="20" r="4" fill="white" />
                        <defs>
                            <linearGradient id="gradH" x1="0" y1="0" x2="40" y2="40">
                                <stop stopColor="#6366f1" />
                                <stop offset="1" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <h1>SecureShare</h1>
                </div>
                <div className="header-right">
                    <span className="user-email">{email}</span>
                    <button className="btn-ghost" onClick={handleLogout}>
                        Sign Out
                    </button>
                </div>
            </header>

            {/* ── Alerts ─────────────────────────────────────────────────────── */}
            {error && (
                <div className="alert alert-error">
                    <span>⚠️</span> {error}
                    <button onClick={() => setError("")}>×</button>
                </div>
            )}
            {success && (
                <div className="alert alert-success">
                    <span>✅</span> {success}
                    <button onClick={() => setSuccess("")}>×</button>
                </div>
            )}

            {/* ── Tabs ───────────────────────────────────────────────────────── */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === "files" ? "active" : ""}`}
                    onClick={() => setActiveTab("files")}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    My Files
                </button>
                <button
                    className={`tab ${activeTab === "upload" ? "active" : ""}`}
                    onClick={() => setActiveTab("upload")}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload File
                </button>
                <button
                    className={`tab ${activeTab === "keys" ? "active" : ""}`}
                    onClick={() => setActiveTab("keys")}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                    My Keys
                </button>
            </div>

            {/* ── Upload Panel ───────────────────────────────────────────────── */}
            {activeTab === "upload" && (
                <div className="panel">
                    <h2>Send Encrypted File</h2>
                    <p className="panel-desc">
                        Files are encrypted in your browser before upload. The server never
                        sees your data.
                    </p>

                    <form onSubmit={handleUpload} className="upload-form">
                        <div className="form-group">
                            <label>Recipient</label>
                            <select
                                value={recipientId}
                                onChange={(e) =>
                                    setRecipientId(e.target.value ? Number(e.target.value) : "")
                                }
                                required
                            >
                                <option value="">Select a user...</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.email}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>File</label>
                            <div
                                className={`file-drop-zone ${selectedFile ? "has-file" : ""}`}
                                onClick={() => document.getElementById("file-input")?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files.length) {
                                        setSelectedFile(e.dataTransfer.files[0]);
                                    }
                                }}
                            >
                                <input
                                    id="file-input"
                                    type="file"
                                    style={{ display: "none" }}
                                    onChange={(e) =>
                                        setSelectedFile(e.target.files?.[0] || null)
                                    }
                                />
                                {selectedFile ? (
                                    <div className="file-selected">
                                        <span className="file-icon">
                                            {getFileIcon(selectedFile.name)}
                                        </span>
                                        <div>
                                            <p className="file-name">{selectedFile.name}</p>
                                            <p className="file-size">
                                                {(selectedFile.size / 1024).toFixed(1)} KB
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="file-placeholder">
                                        <svg
                                            width="40"
                                            height="40"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                        >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                        <p>Drop a file here or click to browse</p>
                                        <p className="hint">Max 50 MB</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {uploadStatus && (
                            <div className="upload-progress">
                                <span className="spinner" /> {uploadStatus}
                            </div>
                        )}

                        <button type="submit" className="btn-primary" disabled={uploading}>
                            {uploading ? (
                                <>
                                    <span className="spinner" /> Encrypting & Uploading...
                                </>
                            ) : (
                                <>🔒 Encrypt & Send</>
                            )}
                        </button>
                    </form>

                    <div className="encryption-info">
                        <h3>🛡️ Encryption Pipeline</h3>
                        <ol>
                            <li>Random AES-256 key generated</li>
                            <li>File encrypted with AES-256-GCM</li>
                            <li>AES key wrapped with recipient's RSA-2048 public key</li>
                            <li>Only encrypted data sent to server</li>
                        </ol>
                    </div>
                </div>
            )}

            {/* ── Files Panel ────────────────────────────────────────────────── */}
            {activeTab === "files" && (
                <div className="panel">
                    <div className="panel-header-row">
                        <h2>Encrypted Files</h2>
                        <button className="btn-ghost" onClick={loadData}>
                            ↻ Refresh
                        </button>
                    </div>

                    {files.length === 0 ? (
                        <div className="empty-state">
                            <svg
                                width="64"
                                height="64"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1"
                            >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <p>No files yet</p>
                            <p className="hint">
                                Upload an encrypted file to get started
                            </p>
                        </div>
                    ) : (
                        <div className="file-list">
                            {files.map((f) => (
                                <div key={f.id} className="file-card">
                                    <div className="file-card-icon">
                                        {getFileIcon(f.filename)}
                                    </div>
                                    <div className="file-card-info">
                                        <p className="file-card-name">{f.filename}</p>
                                        <p className="file-card-meta">
                                            {f.owner_id === userId ? (
                                                <>
                                                    Sent to <strong>{f.recipient_email}</strong>
                                                </>
                                            ) : (
                                                <>
                                                    From <strong>{f.owner_email}</strong>
                                                </>
                                            )}
                                            {" · "}
                                            {new Date(f.uploaded_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="file-card-actions">
                                        {f.recipient_id === userId && (
                                            <button
                                                className="btn-download"
                                                onClick={() => handleDownload(f)}
                                                disabled={downloadingId === f.id}
                                            >
                                                {downloadingId === f.id ? (
                                                    <span className="spinner" />
                                                ) : (
                                                    <>
                                                        <svg
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                        >
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                            <polyline points="7 10 12 15 17 10" />
                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                        </svg>
                                                        Decrypt & Download
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        {f.owner_id === userId && (
                                            <span className="sent-badge">Sent ✓</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Keys Panel ────────────────────────────────────────────────── */}
            {activeTab === "keys" && (
                <div className="panel">
                    <h2>🔑 Your Encryption Keys</h2>
                    <p className="panel-desc">
                        These are your RSA-2048 keys. Your private key never leaves your browser.
                        <strong> Back up your private key</strong> — if you lose it, you cannot decrypt your files.
                    </p>

                    <div className="key-section">
                        <div className="key-header">
                            <h3>Public Key <span className="key-badge public">Shared with server</span></h3>
                            <div className="key-actions">
                                <button className="btn-ghost" onClick={() => {
                                    navigator.clipboard.writeText(publicKey);
                                    setCopied("public");
                                    setTimeout(() => setCopied(""), 2000);
                                }}>
                                    {copied === "public" ? "✓ Copied!" : "📋 Copy"}
                                </button>
                            </div>
                        </div>
                        <pre className="key-display">{publicKey || "Loading..."}</pre>
                    </div>

                    <div className="key-section">
                        <div className="key-header">
                            <h3>Private Key <span className="key-badge private">🔒 Browser only</span></h3>
                            <div className="key-actions">
                                <button className="btn-ghost" onClick={() => {
                                    const pk = localStorage.getItem(`privateKey_${userId}`) || localStorage.getItem("privateKey") || "";
                                    navigator.clipboard.writeText(pk);
                                    setCopied("private");
                                    setTimeout(() => setCopied(""), 2000);
                                }}>
                                    {copied === "private" ? "✓ Copied!" : "📋 Copy"}
                                </button>
                                <button className="btn-ghost" onClick={() => {
                                    const pk = localStorage.getItem(`privateKey_${userId}`) || localStorage.getItem("privateKey") || "";
                                    const blob = new Blob([pk], { type: "text/plain" });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `secureshare_private_key_${email}.txt`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}>
                                    💾 Download
                                </button>
                            </div>
                        </div>
                        <pre className="key-display private-key">
                            {(localStorage.getItem(`privateKey_${userId}`) || localStorage.getItem("privateKey") || "No private key found").substring(0, 80)}...
                        </pre>
                        <p className="key-warning">
                            ⚠️ Never share your private key with anyone. If someone has your private key, they can decrypt all files sent to you.
                        </p>
                    </div>

                    <div className="encryption-info">
                        <h3>🛡️ How it works</h3>
                        <ol>
                            <li><strong>Public key</strong> is stored on the server — anyone can use it to encrypt files FOR you</li>
                            <li><strong>Private key</strong> stays in your browser — only YOU can decrypt files sent to you</li>
                            <li>The server <strong>never sees</strong> your private key or your plaintext files</li>
                        </ol>
                    </div>
                </div>
            )}
        </div>
    );
}
