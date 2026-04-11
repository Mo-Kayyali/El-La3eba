"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { api, refreshAuthProfile, syncAxiosAuthFromStore } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);

  useEffect(() => {
    const unsub = useAuthStore.subscribe(() => {
      syncAxiosAuthFromStore();
    });
    syncAxiosAuthFromStore();
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await useAuthStore.persist.rehydrate();
      if (cancelled) return;
      syncAxiosAuthFromStore();
      const token = useAuthStore.getState().accessToken;
      if (token) await refreshAuthProfile();
      if (!cancelled) setBootstrapped(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [setBootstrapped]);

  useEffect(() => {
    if (!bootstrapped) return;
    if (pathname !== "/" && pathname !== "/lobby") return;
    if (!accessToken) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<{ gameSessionId: string | null }>(
          "/game/active-game"
        );
        if (cancelled) return;
        const gid = data?.gameSessionId;
        if (gid) router.replace(`/game/${gid}`);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrapped, pathname, router, accessToken]);

  return (
    <>
      {children}
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        className="!top-4 !right-4 !z-[100]"
        toastOptions={{
          classNames: {
            toast: "!border-white/10 !bg-zinc-900/95 !backdrop-blur-xl",
          },
        }}
      />
    </>
  );
}
