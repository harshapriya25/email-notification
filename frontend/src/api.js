const API = import.meta.env.VITE_API_URL || "";
export async function api(path, options = {}) {
  const response = await fetch(`${API}/api/auth${path}`, {
    ...options, credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}
export const oauthUrl = (provider) => `${API}/api/auth/${provider}`;
