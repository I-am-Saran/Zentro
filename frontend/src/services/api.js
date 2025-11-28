const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  if (!BASE_URL) {
    throw new Error("API base URL not configured. Set VITE_API_BASE_URL.");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
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
    const msg = body?.message || (typeof body === "string" ? body : "Request failed");
    throw new Error(msg);
  }
  return body;
}

export async function get(path) {
  return request(path);
}

export async function post(path, data) {
  return request(path, { method: "POST", body: JSON.stringify(data) });
}