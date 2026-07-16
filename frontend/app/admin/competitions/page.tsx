"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api, extractApiErrorMessage } from "@/lib/api";

type Competition = {
  id: string;
  name: string;
  type: string;
  countryCode: string | null;
  tier: number | null;
};

export default function AdminCompetitionsPage() {
  const router = useRouter();
  const { user, bootstrapped } = useAuthStore();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isEditing, setIsEditing] = useState<Partial<Competition> | null>(null);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!user || user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchCompetitions();
  }, [bootstrapped, user, router]);

  const fetchCompetitions = async () => {
    try {
      const { data } = await api.get<Competition[]>("/admin/competitions");
      setCompetitions(data);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      type: formData.get("type") as string,
      countryCode: (formData.get("countryCode") as string) || null,
      tier: formData.get("tier") ? Number(formData.get("tier")) : null,
    };

    try {
      if (isEditing?.id) {
        await api.patch(`/admin/competitions/${isEditing.id}`, payload);
      } else {
        await api.post("/admin/competitions", payload);
      }
      setIsEditing(null);
      fetchCompetitions();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    setError("");
    try {
      await api.delete(`/admin/competitions/${id}`);
      fetchCompetitions();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  if (!bootstrapped || loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-slate-200">
      <div className="mb-8 flex items-center justify-between border-b border-white/[0.06] pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Competitions</h1>
          <p className="mt-1 text-sm text-slate-400">Manage domestic and international competitions.</p>
        </div>
        <button
          onClick={() => setIsEditing({})}
          className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-bold text-blue-300 hover:bg-blue-500/20 transition"
        >
          Add Competition
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isEditing && (
        <div className="mb-8 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl">
          <h2 className="mb-5 text-lg font-bold text-white">
            {isEditing.id ? "Edit Competition" : "New Competition"}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Name</label>
                <input
                  name="name"
                  defaultValue={isEditing.name || ""}
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Type</label>
                <select
                  name="type"
                  defaultValue={isEditing.type || "DOMESTIC_LEAGUE"}
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="DOMESTIC_LEAGUE" className="bg-slate-900">Domestic League</option>
                  <option value="DOMESTIC_CUP" className="bg-slate-900">Domestic Cup</option>
                  <option value="CONTINENTAL_CLUB" className="bg-slate-900">Continental Club</option>
                  <option value="INTERNATIONAL_NATIONAL_TEAM" className="bg-slate-900">International / National Team</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Country Code (ISO-3)</label>
                <input
                  name="countryCode"
                  defaultValue={isEditing.countryCode || ""}
                  placeholder="e.g. ENG"
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Tier</label>
                <input
                  name="tier"
                  type="number"
                  defaultValue={isEditing.tier || ""}
                  placeholder="e.g. 1"
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(null)}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-white/[0.06] bg-white/[0.02]">
              <tr>
                <th className="px-5 py-4 font-semibold text-slate-300">Name</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Type</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Country</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Tier</th>
                <th className="px-5 py-4 font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {competitions.map((comp) => (
                <tr key={comp.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-4 font-medium text-white">{comp.name}</td>
                  <td className="px-5 py-4 text-slate-400">{comp.type}</td>
                  <td className="px-5 py-4 text-slate-300">{comp.countryCode || "-"}</td>
                  <td className="px-5 py-4 text-slate-300">{comp.tier || "-"}</td>
                  <td className="px-5 py-4 flex justify-end gap-3">
                    <button
                      onClick={() => setIsEditing(comp)}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(comp.id)}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {competitions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No competitions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
