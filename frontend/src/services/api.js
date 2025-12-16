const env = import.meta.env || {};
let BASE_URL =
  env.VITE_API_BASE_URL ||
  env.VITE_API_BASE ||
  env.VITE_PUBLIC_API_BASE_URL ||
  env.VITE_PUBLIC_API_BASE ||
  "";

try {
  const originHost = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalOrigin = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(originHost);
  const hasExplicitBase = Boolean(
    env.VITE_API_BASE_URL || env.VITE_API_BASE || env.VITE_PUBLIC_API_BASE_URL || env.VITE_PUBLIC_API_BASE
  );
  if (isLocalOrigin) {
    BASE_URL = "";
  }
  if (!isLocalOrigin && !hasExplicitBase) {
    BASE_URL = "https://nexus-z97n.onrender.com";
  }
} catch { void 0; }


BASE_URL = String(BASE_URL).replace(/\/$/, "");

async function request(path, options = {}) {
  // If BASE_URL is not set, we assume relative path (proxy in dev, same origin in prod)
  const url = BASE_URL ? `${BASE_URL}${path}` : path;
  
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let body;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && (body.detail || body.message)) ||
      (typeof body === "string" ? body : "Request failed");
    console.error(`[API Error] ${path}: ${msg}`, body);
    throw new Error(msg);
  }
  return body;
}

export async function get(path) {
  return request(path);
}

export async function post(path, data) {
  console.log(`[API POST] ${path}:`, data);
  return request(path, { method: "POST", body: JSON.stringify(data) });
}

export async function put(path, data) {
  return request(path, { method: "PUT", body: JSON.stringify(data) });
}

export async function del(path) {
  return request(path, { method: "DELETE" });
}

// Export the resolved base for reuse in ad-hoc fetches
export const API_BASE = BASE_URL;
