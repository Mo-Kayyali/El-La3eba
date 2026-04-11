import axios from "axios";
import { useAuthStore } from "@/lib/auth-store";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

/** Shared REST client — attaches Bearer token from the auth store per request. */
export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

/** Keeps `axios.defaults` in sync for any ad-hoc `axios.get` calls in legacy code. */
export function syncAxiosAuthFromStore() {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
    delete api.defaults.headers.common.Authorization;
  }
}

export async function refreshAuthProfile(): Promise<void> {
  const { accessToken, setUser, logout } = useAuthStore.getState();
  if (!accessToken) return;
  try {
    const { data } = await api.get("/auth/me");
    setUser(data);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      logout();
      syncAxiosAuthFromStore();
    }
  }
}
