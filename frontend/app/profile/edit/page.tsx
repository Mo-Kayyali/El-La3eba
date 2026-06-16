"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Save } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { updateOwnProfile } from "@/lib/api";

const PASSWORD_REGEX = /^(?=(?:.*[A-Za-z]){3,})(?=.*\d).+$/;

export default function EditProfilePage() {
  const router = useRouter();
  const { user, accessToken, bootstrapped, setUser } = useAuthStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!accessToken) {
      router.replace("/");
      return;
    }

    setUsername(typeof user?.username === "string" ? user.username : "");
    setEmail(typeof user?.email === "string" ? user.email : "");
  }, [accessToken, bootstrapped, router, user?.email, user?.username]);

  const trimmedUsername = useMemo(() => username.trim(), [username]);
  const trimmedEmail = useMemo(() => email.trim(), [email]);

  function validateClient(): string | null {
    if (trimmedUsername.length < 3 || trimmedUsername.length > 24) {
      return "Username must be between 3 and 24 characters.";
    }

    if (!/^[A-Za-z0-9_]+$/.test(trimmedUsername)) {
      return "Username can only contain letters, numbers, and underscores.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return "Please enter a valid email address.";
    }

    if (password && !PASSWORD_REGEX.test(password)) {
      return "Password must contain at least 3 letters and at least 1 number.";
    }

    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateClient();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: { username?: string; email?: string; password?: string } =
      {};

    if (trimmedUsername !== (user?.username ?? ""))
      payload.username = trimmedUsername;
    if (trimmedEmail !== (user?.email ?? "")) payload.email = trimmedEmail;
    if (password) payload.password = password;

    if (Object.keys(payload).length === 0) {
      setError("No changes detected.");
      return;
    }

    setSaving(true);

    try {
      const updated = await updateOwnProfile(payload);
      setUser({ ...user, ...updated });
      router.push("/profile");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message;
        if (Array.isArray(msg)) {
          setError(msg.join(", "));
        } else if (typeof msg === "string") {
          setError(msg);
        } else {
          setError("Failed to update profile.");
        }
      } else {
        setError("Failed to update profile.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400/40 border-t-blue-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_-10%,rgba(14,165,233,0.2),transparent_60%)]" />
      </div>

      <main className="relative mx-auto w-full max-w-2xl px-5 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_80px_rgba(2,132,199,0.15)] backdrop-blur-xl sm:p-8">
          <h1 className="text-3xl font-black tracking-tight text-white">
            Edit Profile
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Update your username, email, and password.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <Field
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="Username"
            />
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Leave blank to keep current"
            />
            <p className="text-xs text-slate-500">
              Password rule: at least 3 letters and at least 1 number.
            </p>

            {error && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
              <Link
                href="/profile"
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "email" | "password";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/60"
        placeholder={placeholder}
      />
    </label>
  );
}
