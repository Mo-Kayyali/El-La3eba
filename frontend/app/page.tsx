"use client";

import axios, { AxiosError } from "axios";
import { Lock, Mail, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { syncAxiosAuthFromStore } from "@/lib/api";
import { useAuthStore } from "../lib/auth-store";

type Mode = "login" | "register";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Sleek SVG logo for El-La3eba */
function Logo({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center gap-2.5 select-none", className)}>
      {/* Ball icon */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="16"
          cy="16"
          r="15"
          stroke="url(#ball-grad)"
          strokeWidth="2"
        />
        <path
          d="M16 4 L20 10 L14 14 L10 9 Z"
          fill="url(#ball-grad)"
          opacity="0.9"
        />
        <path
          d="M22 8 L26 14 L22 20 L16 18 L14 14 L20 10 Z"
          fill="url(#ball-grad2)"
          opacity="0.7"
        />
        <path
          d="M10 22 L14 14 L16 18 L14 26 Z"
          fill="url(#ball-grad)"
          opacity="0.8"
        />
        <defs>
          <linearGradient
            id="ball-grad"
            x1="0"
            y1="0"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#3b82f6" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient
            id="ball-grad2"
            x1="32"
            y1="0"
            x2="0"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#60a5fa" />
            <stop offset="1" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      {/* Text */}
      <span className="text-xl font-extrabold tracking-tight">
        <span className="text-white">El-</span>
        <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          La3eba
        </span>
      </span>
    </div>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const activeGameSessionId = useAuthStore((s) =>
    typeof s.user?.activeGameSessionId === "string"
      ? s.user.activeGameSessionId
      : null,
  );
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const title = useMemo(
    () => (mode === "login" ? "Welcome back" : "Create account"),
    [mode],
  );

  useEffect(() => {
    if (!bootstrapped || !isAuthenticated) return;
    if (activeGameSessionId) return;
    router.replace("/lobby");
  }, [activeGameSessionId, bootstrapped, isAuthenticated, router]);

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
          rememberMe,
        });

        const accessToken: string | undefined = res.data?.access_token;
        const user = res.data?.user;
        if (!accessToken || !user)
          throw new Error("Unexpected server response.");

        setAuth({ accessToken, user });
        syncAxiosAuthFromStore();
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
      setSuccess("Account created! Please log in.");
    } catch (err) {
      const fallback = "Something went wrong. Please try again.";
      type ApiErrorResponse = {
        message?: string | string[];
        error?: string;
        [key: string]: unknown;
      };

      const ax = err as AxiosError<ApiErrorResponse>;
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
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      {/* ── Stadium atmosphere background ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Pitch lines overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(29,78,216,0.18),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_80%_110%,rgba(109,40,217,0.14),transparent_55%)]" />
        {/* Stadium light shafts */}
        <div className="absolute -top-32 left-[-8%] h-[700px] w-[320px] rotate-[18deg] bg-gradient-to-b from-blue-600/10 to-transparent blur-3xl" />
        <div className="absolute -top-32 right-[-8%] h-[700px] w-[320px] rotate-[-18deg] bg-gradient-to-b from-violet-600/10 to-transparent blur-3xl" />
        {/* Subtle pitch center circle */}
        <div className="absolute bottom-[-30%] left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full border border-white/[0.025]" />
        <div className="absolute bottom-[-18%] left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full border border-white/[0.02]" />
        {/* Top vignette */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,7,18,0.6),transparent_40%,rgba(3,7,18,0.4))]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-between px-6 py-14 gap-10">
        {/* ── Left: Branding ── */}
        <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:pr-10">
          <Logo className="mb-8" />

          <h1 className="text-balance text-4xl font-extrabold tracking-tight text-white leading-tight">
            The Ultimate
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Football Quiz
            </span>
          </h1>

          <p className="mt-4 max-w-sm text-base leading-7 text-slate-400">
            Name the players. Beat the clock. Climb the ranks. Real-time
            head-to-head football trivia.
          </p>

          {/* Feature grid */}
          <div className="mt-10 grid max-w-sm grid-cols-2 gap-3">
            {[
              { icon: "⚡", label: "Real-time", desc: "Sub-100ms gameplay" },
              { icon: "🏆", label: "Ranked", desc: "Global Elo ladder" },
              { icon: "🎯", label: "Best of 3", desc: "Rounds per match" },
              { icon: "🔒", label: "Private rooms", desc: "Play with friends" },
            ].map((f) => (
              <div
                key={f.label}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4 backdrop-blur"
              >
                <span className="text-xl">{f.icon}</span>
                <p className="mt-1.5 text-sm font-semibold text-white">
                  {f.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Live indicator */}
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-xs text-emerald-300 w-fit">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
            Servers online
          </div>
        </div>

        {/* ── Right: Auth card ── */}
        <div className="w-full max-w-md flex-shrink-0 mx-auto lg:mx-0">
          {/* Logo on mobile */}
          <div className="mb-6 flex justify-center lg:hidden">
            <Logo />
          </div>

          <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.04] p-7 shadow-[0_0_80px_rgba(29,78,216,0.12),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl sm:p-9">
            {/* Card top accent line */}
            <div className="absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {mode === "login"
                  ? "Log in to enter the arena."
                  : "Join the league — it's free."}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="mb-6 rounded-2xl border border-white/[0.08] bg-black/30 p-1">
              <div className="relative grid grid-cols-2">
                <div
                  className={cx(
                    "pointer-events-none absolute inset-y-1 w-1/2 rounded-xl bg-gradient-to-b from-blue-600/30 to-blue-600/10 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)] transition-transform duration-300",
                    mode === "register" && "translate-x-full",
                  )}
                />
                {(["login", "register"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={cx(
                      "relative z-10 rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-colors",
                      mode === m
                        ? "text-white"
                        : "text-slate-400 hover:text-white",
                    )}
                  >
                    {m === "login" ? "Log in" : "Register"}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Username (register only) */}
              <div
                className={cx(
                  "transition-[opacity,max-height] duration-300 overflow-hidden",
                  mode === "register"
                    ? "opacity-100 max-h-24"
                    : "opacity-0 max-h-0 pointer-events-none",
                )}
                aria-hidden={mode !== "register"}
              >
                <Field
                  label="Username"
                  value={username}
                  onChange={setUsername}
                  placeholder="yourname"
                  autoComplete="username"
                  required={mode === "register"}
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
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                icon={<Lock className="h-4 w-4" />}
              />

              {mode === "login" && (
                <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/50 text-blue-500 focus:ring-blue-500/40"
                  />
                  <span className="text-sm text-slate-300">
                    Remember me{" "}
                    <span className="text-slate-500">
                      (stay signed in 30 days)
                    </span>
                  </span>
                </label>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-300">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={cx(
                  "group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3.5 text-sm font-bold text-white transition-all",
                  "shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.45)]",
                  "hover:brightness-110 active:scale-[0.99]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                <span className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
                <span className="relative">
                  {loading
                    ? "Processing…"
                    : mode === "login"
                      ? "Enter the Arena"
                      : "Create Account"}
                </span>
              </button>

              <p className="text-center text-xs text-slate-500">
                By continuing you agree to fair play and community rules.
              </p>
            </form>
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
  required?: boolean;
  icon: React.ReactNode;
}) {
  const {
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    autoComplete,
    icon,
  } = props;
  const required = props.required ?? true;

  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-slate-300">{label}</div>
      <div className="group relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-500 transition-colors group-focus-within:text-blue-400">
          {icon}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          className={cx(
            "w-full rounded-2xl border border-white/[0.08] bg-black/40 px-4 py-3 pl-11 text-sm text-white outline-none transition",
            "placeholder:text-slate-600",
            "focus:border-blue-500/40 focus:ring-4 focus:ring-blue-500/10",
            "hover:border-white/[0.15]",
          )}
        />
      </div>
    </label>
  );
}
