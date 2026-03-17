"use client";

import axios, { AxiosError } from "axios";
import { Lock, Mail, User, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuthStore } from "../lib/auth-store";

type Mode = "login" | "register";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Home() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const title = useMemo(
    () => (mode === "login" ? "Welcome back" : "Create your account"),
    [mode]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await axios.post("http://localhost:3000/auth/login", {
          email,
          password,
        });

        const accessToken: string | undefined = res.data?.access_token;
        const user = res.data?.user;
        if (!accessToken || !user) throw new Error("Unexpected server response.");

        setAuth({ accessToken, user });
        router.push("/lobby");
        return;
      }

      await axios.post("http://localhost:3000/auth/register", {
        username,
        email,
        password,
      });

      setMode("login");
      setPassword("");
      setSuccess("Account created. Please log in.");
    } catch (err) {
      const fallback = "Something went wrong. Please try again.";
      const ax = err as AxiosError<any>;
      const msg =
        ax.response?.data?.message ??
        ax.response?.data?.error ??
        (typeof ax.message === "string" ? ax.message : null) ??
        fallback;

      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06080d] text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_20%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(900px_circle_at_70%_70%,rgba(56,189,248,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_40%,rgba(255,255,255,0.02))]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-14">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.7)]" />
              Real-time multiplayer
            </div>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-white">
              El-La3eba
            </h1>
            <p className="mt-3 max-w-md text-pretty text-base leading-7 text-zinc-300">
              Predict. Compete. Climb the leaderboard. Join fast rounds, lock in
              your picks, and watch the game unfold live.
            </p>

            <div className="mt-8 grid max-w-md grid-cols-2 gap-4">
              {[
                { label: "Low latency", value: "Real-time gameplay" },
                { label: "Secure", value: "JWT auth" },
                { label: "Competitive", value: "Ranked lobbies" },
                { label: "Social", value: "Friends & rooms" },
              ].map((it) => (
                <div
                  key={it.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                >
                  <div className="text-sm font-medium text-white">{it.label}</div>
                  <div className="mt-1 text-xs text-zinc-300">{it.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm text-zinc-200">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                    Secure access
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-300">
                    {mode === "login"
                      ? "Log in to enter the lobby."
                      : "Register to start playing."}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-1">
                <div className="relative grid grid-cols-2">
                  <div
                    className={cx(
                      "pointer-events-none absolute inset-y-1 w-1/2 rounded-xl bg-gradient-to-b from-white/10 to-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.35)] transition-transform duration-300",
                      mode === "register" && "translate-x-full"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setSuccess(null);
                    }}
                    className={cx(
                      "relative z-10 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                      mode === "login"
                        ? "text-white"
                        : "text-zinc-300 hover:text-white"
                    )}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                      setSuccess(null);
                    }}
                    className={cx(
                      "relative z-10 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                      mode === "register"
                        ? "text-white"
                        : "text-zinc-300 hover:text-white"
                    )}
                  >
                    Register
                  </button>
                </div>
              </div>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div
                  className={cx(
                    "grid gap-4 transition-[opacity,transform] duration-300",
                    mode === "register" ? "opacity-100" : "opacity-0 -translate-y-1 pointer-events-none h-0 overflow-hidden"
                  )}
                  aria-hidden={mode !== "register"}
                >
                  <Field
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    placeholder="yourname"
                    autoComplete="username"
                    icon={<User className="h-4 w-4" />}
                  />
                </div>

                <Field
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  icon={<Mail className="h-4 w-4" />}
                />
                <Field
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  icon={<Lock className="h-4 w-4" />}
                />

                {error ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    {success}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className={cx(
                    "group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-3 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(16,185,129,0.22)] transition-all",
                    "hover:brightness-110 hover:shadow-[0_20px_70px_rgba(56,189,248,0.18)] active:translate-y-px",
                    "disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                >
                  <span className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(600px_circle_at_30%_10%,rgba(255,255,255,0.35),transparent_40%)]" />
                  <span className="relative">
                    {loading
                      ? "Processing…"
                      : mode === "login"
                        ? "Enter Lobby"
                        : "Create Account"}
                  </span>
                </button>

                <p className="text-center text-xs leading-5 text-zinc-400">
                  By continuing, you agree to fair play and community rules.
                </p>
              </form>
            </div>

            <div className="mt-6 text-center text-xs text-zinc-500">
              Backend: <span className="text-zinc-300">localhost:3000</span> ·
              Frontend: <span className="text-zinc-300">localhost:3001</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  icon: React.ReactNode;
}) {
  const { label, value, onChange, placeholder, type = "text", autoComplete, icon } =
    props;

  return (
    <label className="block">
      <div className="mb-2 text-xs font-medium text-zinc-200">{label}</div>
      <div className="group relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-zinc-400 transition-colors group-focus-within:text-emerald-300">
          {icon}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          className={cx(
            "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 pl-11 text-sm text-white outline-none transition",
            "placeholder:text-zinc-500",
            "focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-500/10",
            "hover:border-white/20"
          )}
        />
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]" />
      </div>
    </label>
  );
}
