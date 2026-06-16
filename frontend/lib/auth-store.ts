import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  id?: string | number;
  username?: string;
  email?: string;
  activeGameSessionId?: string | null;
  mmr?: number;
  wins?: number;
  gamesPlayed?: number;
  isVerified?: boolean;
  createdAt?: string;
  [key: string]: unknown;
};

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /**
   * True after storage rehydration (and optional `/auth/me` refresh) finishes.
   * Used to avoid treating the default empty store as "logged out" on hard refresh.
   */
  bootstrapped: boolean;
  setAuth: (payload: { accessToken: string; user: AuthUser }) => void;
  setUser: (user: AuthUser) => void;
  /** Apply ranked delta after a match so lobby MMR stays in sync without refetch. */
  applyMmrDelta: (delta: number) => void;
  setBootstrapped: (value: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      bootstrapped: false,
      setAuth: ({ accessToken, user }) => {
        if (typeof document !== "undefined") {
          document.cookie = `el_la3eba_token=${encodeURIComponent(accessToken)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        }
        set({ accessToken, user, isAuthenticated: true });
      },
      setUser: (user) => set({ user, isAuthenticated: true }),
      applyMmrDelta: (delta) =>
        set((s) => {
          if (!s.user || typeof s.user.mmr !== "number") return s;
          return { user: { ...s.user, mmr: s.user.mmr + delta } };
        }),
      setBootstrapped: (bootstrapped) => set({ bootstrapped }),
      logout: () => {
        if (typeof document !== "undefined") {
          document.cookie =
            "el_la3eba_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax";
        }
        set({
          accessToken: null,
          user: null,
          isAuthenticated: false,
          bootstrapped: true,
        });
      },
    }),
    {
      name: "el-la3eba-auth",
      skipHydration: true,
      partialize: (s) => ({
        accessToken: s.accessToken,
        user: s.user,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
);
