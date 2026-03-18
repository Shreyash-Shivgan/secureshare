// /**
//  * SecureShare – API Client
//  * Fetch-based HTTP helper with automatic JWT injection.
//  */

// const API_URL = import.meta.env.VITE_API_URL;;


// function getToken(): string | null {
//     return localStorage.getItem("token");
// }

// function authHeaders(): Record<string, string> {
//     const token = getToken();
//     const headers: Record<string, string> = {};
//     if (token) {
//         headers["Authorization"] = `Bearer ${token}`;
//     }
//     return headers;
// }


// // ── Auth ─────────────────────────────────────────────────────────────────────

// export interface AuthResponse {
//     access_token: string;
//     token_type: string;
//     user_id: number;
//     email: string;
// }

// export async function register(
//     email: string,
//     password: string,
//     publicKey: string
// ): Promise<AuthResponse> {
//     const res = await fetch(`${API_BASE}/register`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email, password, public_key: publicKey }),
//     });

//     if (!res.ok) {
//         const err = await res.json();
//         throw new Error(err.detail || "Registration failed");
//     }

//     return res.json();
// }

// export async function login(
//     email: string,
//     password: string
// ): Promise<AuthResponse> {
//     const res = await fetch(`${API_BASE}/login`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email, password }),
//     });

//     if (!res.ok) {
//         const err = await res.json();
//         throw new Error(err.detail || "Login failed");
//     }

//     return res.json();
// }


// // ── Users ────────────────────────────────────────────────────────────────────

// export interface UserInfo {
//     id: number;
//     email: string;
//     public_key: string;
// }

// export async function fetchUsers(): Promise<UserInfo[]> {
//     const res = await fetch(`${API_BASE}/users`, {
//         headers: authHeaders(),
//     });

//     if (!res.ok) throw new Error("Failed to fetch users");

//     return res.json();
// }


// // ── Files ────────────────────────────────────────────────────────────────────

// export interface FileInfo {
//     id: number;
//     filename: string;
//     owner_id: number;
//     owner_email: string;
//     recipient_id: number;
//     recipient_email: string;
//     encrypted_key: string;
//     uploaded_at: string;
// }

// export async function uploadFile(
//     encryptedBlob: Blob,
//     encryptedKey: string,
//     recipientId: number,
//     originalFilename: string
// ): Promise<{ message: string; file_id: number }> {

//     const formData = new FormData();
//     formData.append("file", encryptedBlob, `${originalFilename}.enc`);
//     formData.append("encrypted_key", encryptedKey);
//     formData.append("recipient_id", recipientId.toString());
//     formData.append("original_filename", originalFilename);

//     const res = await fetch(`${API_BASE}/upload`, {
//         method: "POST",
//         headers: authHeaders(),
//         body: formData,
//     });

//     if (!res.ok) {
//         const err = await res.json();
//         throw new Error(err.detail || "Upload failed");
//     }

//     return res.json();
// }

// export async function fetchFiles(): Promise<FileInfo[]> {
//     const res = await fetch(`${API_BASE}/files`, {
//         headers: authHeaders(),
//     });

//     if (!res.ok) throw new Error("Failed to fetch files");

//     return res.json();
// }

// export async function downloadFile(
//     fileId: number
// ): Promise<{ data: ArrayBuffer; encryptedKey: string; filename: string }> {

//     const res = await fetch(`${API_BASE}/download/${fileId}`, {
//         headers: authHeaders(),
//     });

//     if (!res.ok) throw new Error("Download failed");

//     const encryptedKey = res.headers.get("X-Encrypted-Key") || "";
//     const filename = res.headers.get("X-Original-Filename") || "download";
//     const data = await res.arrayBuffer();

//     return { data, encryptedKey, filename };
// }
/**
 * SecureShare – API Client
 * Fetch-based HTTP helper with automatic JWT injection.
 */

const API_BASE = import.meta.env.VITE_API_URL;;

function getToken(): string | null {
    return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}


// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user_id: number;
    email: string;
}

export async function register(
    email: string,
    password: string,
    publicKey: string
): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, public_key: publicKey }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Registration failed");
    }

    return res.json();
}

export async function login(
    email: string,
    password: string
): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Login failed");
    }

    return res.json();
}


// ── Users ────────────────────────────────────────────────────────────────────

export interface UserInfo {
    id: number;
    email: string;
    public_key: string;
}

export async function fetchUsers(): Promise<UserInfo[]> {
    const res = await fetch(`${API_BASE}/users`, {
        headers: authHeaders(),
    });

    if (!res.ok) throw new Error("Failed to fetch users");

    return res.json();
}


// ── Files ────────────────────────────────────────────────────────────────────

export interface FileInfo {
    id: number;
    filename: string;
    owner_id: number;
    owner_email: string;
    recipient_id: number;
    recipient_email: string;
    encrypted_key: string;
    uploaded_at: string;
}

export async function uploadFile(
    encryptedBlob: Blob,
    encryptedKey: string,
    recipientId: number,
    originalFilename: string
): Promise<{ message: string; file_id: number }> {

    const formData = new FormData();
    formData.append("file", encryptedBlob, `${originalFilename}.enc`);
    formData.append("encrypted_key", encryptedKey);
    formData.append("recipient_id", recipientId.toString());
    formData.append("original_filename", originalFilename);

    const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
    }

    return res.json();
}

export async function fetchFiles(): Promise<FileInfo[]> {
    const res = await fetch(`${API_BASE}/files`, {
        headers: authHeaders(),
    });

    if (!res.ok) throw new Error("Failed to fetch files");

    return res.json();
}

export async function downloadFile(
    fileId: number
): Promise<{ data: ArrayBuffer; encryptedKey: string; filename: string }> {

    const res = await fetch(`${API_BASE}/download/${fileId}`, {
        headers: authHeaders(),
    });

    if (!res.ok) throw new Error("Download failed");

    const encryptedKey = res.headers.get("X-Encrypted-Key") || "";
    const filename = res.headers.get("X-Original-Filename") || "download";
    const data = await res.arrayBuffer();

    return { data, encryptedKey, filename };
}