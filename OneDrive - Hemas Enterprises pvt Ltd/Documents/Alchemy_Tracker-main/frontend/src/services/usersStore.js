// Lightweight local storage for demo mode user persistence
// Shape aligns with src/data/users.js: { id, name, role, email }

const STORAGE_KEY = "usersExtra";

export function getStoredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addStoredUser(user) {
  const current = getStoredUsers();
  const next = [...current, user];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function removeStoredUser(id) {
  const current = getStoredUsers();
  const next = current.filter((u) => u.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getUsersMerged(seedUsers = []) {
  const extras = getStoredUsers();
  // Basic de-dup by id; if collision, prefer extras
  const byId = new Map();
  for (const u of seedUsers) byId.set(u.id, u);
  for (const u of extras) byId.set(u.id, u);
  return Array.from(byId.values());
}