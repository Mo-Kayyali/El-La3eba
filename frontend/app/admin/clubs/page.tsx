"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, extractApiErrorMessage } from "@/lib/api";

type Club = {
  id: string;
  name: string;
  aliases: string[];
  countryCode: string | null;
  currentCompetitionId: string | null;
  logoUrl: string | null;
  clubCompetitions?: { competitionId: string }[];
};

type Competition = {
  id: string;
  name: string;
};

type Country = {
  id: string;
  name: string;
};

export default function AdminClubsPage() {
  const router = useRouter();
  const { user, bootstrapped } = useAuthStore();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState<Partial<Club> & { competitionIds?: string[] } | null>(null);
  const [selectedComps, setSelectedComps] = useState<string[]>([]);
  const [filterCompId, setFilterCompId] = useState<string>("");

  useEffect(() => {
    if (!bootstrapped) return;
    if (!user || user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchData();
  }, [bootstrapped, user, router]);

  const fetchData = async () => {
    try {
      const [clubsRes, compsRes, countriesRes] = await Promise.all([
        api.get<Club[]>("/admin/clubs"),
        api.get<Competition[]>("/admin/competitions"),
        api.get<Country[]>("/admin/countries"),
      ]);
      setClubs(clubsRes.data);
      setCompetitions(compsRes.data);
      setCountries(countriesRes.data);
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
    const aliasesRaw = formData.get("aliases") as string;
    
    const payload = {
      name: formData.get("name"),
      aliases: aliasesRaw ? aliasesRaw.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      countryCode: formData.get("countryCode"),
      currentCompetitionId: (formData.get("currentCompetitionId") as string) || null,
      competitionIds: selectedComps,
      logoUrl: (formData.get("logoUrl") as string) || null,
    };

    // Auto-set currentCompetitionId to the first competition if empty and competitions selected
    if (!payload.currentCompetitionId && payload.competitionIds.length > 0) {
      payload.currentCompetitionId = payload.competitionIds[0];
    }

    try {
      if (isEditing?.id) {
        await api.patch(`/admin/clubs/${isEditing.id}`, payload);
      } else {
        await api.post("/admin/clubs", payload);
      }
      setIsEditing(null);
      fetchData();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    setError("");
    try {
      await api.delete(`/admin/clubs/${id}`);
      fetchData();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleEdit = (club: Club) => {
    const compIds = club.clubCompetitions?.map(cc => cc.competitionId) || [];
    setIsEditing({ ...club, competitionIds: compIds });
    setSelectedComps(compIds);
  };

  const handleCreateNew = () => {
    setIsEditing({});
    setSelectedComps([]);
  };

  const filteredClubs = clubs.filter(c => {
    if (!filterCompId) return true;
    return c.currentCompetitionId === filterCompId || c.clubCompetitions?.some(cc => cc.competitionId === filterCompId);
  });

  if (!bootstrapped || loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-slate-200">
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
      <div className="mb-8 flex items-center justify-between border-b border-white/[0.06] pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Clubs & Teams</h1>
          <p className="mt-1 text-sm text-slate-400">Manage football clubs, aliases, and logos.</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20 transition"
        >
          Add Club
        </button>
      </div>

      <div className="mb-6 flex items-center justify-end">
        <div className="w-64">
          <select
            value={filterCompId}
            onChange={(e) => setFilterCompId(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-slate-300 outline-none transition focus:border-emerald-500/40"
          >
            <option value="">All Competitions</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isEditing && (
        <div className="mb-8 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl">
          <h2 className="mb-5 text-lg font-bold text-white">
            {isEditing.id ? "Edit Club" : "New Club"}
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
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Aliases (comma separated)</label>
                <input
                  name="aliases"
                  defaultValue={isEditing.aliases?.join(", ") || ""}
                  placeholder="e.g. Man Utd, Red Devils"
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Country Code</label>
                <input
                  name="countryCode"
                  list="countries-list"
                  defaultValue={isEditing.countryCode || ""}
                  required
                  placeholder="Type code or search name..."
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                />
                <datalist id="countries-list">
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Current / Display Competition</label>
                <select
                  name="currentCompetitionId"
                  defaultValue={isEditing.currentCompetitionId || ""}
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">-- None --</option>
                  {competitions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 space-y-3">
                <label className="block text-xs font-semibold text-slate-300">Competitions (Tag List)</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10"
                    onChange={(e) => {
                      if (e.target.value && !selectedComps.includes(e.target.value)) {
                        setSelectedComps([...selectedComps, e.target.value]);
                      }
                      e.target.value = "";
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Add a competition...</option>
                    {competitions.filter(c => !selectedComps.includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {selectedComps.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedComps.map(compId => {
                      const comp = competitions.find(c => c.id === compId);
                      return (
                        <div key={compId} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
                          {comp?.name || "Unknown"}
                          <button
                            type="button"
                            onClick={() => setSelectedComps(selectedComps.filter(id => id !== compId))}
                            className="text-slate-400 hover:text-red-400"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-slate-500">Current competition will default to the first tag if left empty.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Logo URL</label>
                <input
                  name="logoUrl"
                  defaultValue={isEditing.logoUrl || ""}
                  placeholder="https://..."
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
                <th className="px-5 py-4 font-semibold text-slate-300">Country</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Aliases</th>
                <th className="px-5 py-4 font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredClubs.map((club) => (
                <tr key={club.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-4 font-medium text-white">{club.name}</td>
                  <td className="px-5 py-4 text-slate-300">{club.countryCode}</td>
                  <td className="px-5 py-4 text-slate-400">
                    {club.aliases.length > 0 ? club.aliases.join(", ") : "-"}
                  </td>
                  <td className="px-5 py-4 flex justify-end gap-3">
                    <button
                      onClick={() => handleEdit(club)}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(club.id)}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClubs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No clubs found.
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
