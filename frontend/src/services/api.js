const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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

export async function put(path, data) {
  return request(path, { method: "PUT", body: JSON.stringify(data) });
}

export async function del(path) {
  return request(path, { method: "DELETE" });
}
