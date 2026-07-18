"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, extractApiErrorMessage } from "@/lib/api";
import { FilterSelect } from "@/components/filter-select";

type Competition = {
  id: string;
  name: string;
  type: string;
  countryCode: string | null;
  region: string | null;
  tier: number | null;
};

type Country = { id: string; name: string };

export default function AdminCompetitionsPage() {
  const router = useRouter();
  const { user, bootstrapped } = useAuthStore();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filterCompCountryCode, setFilterCompCountryCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState<string[]>([]);

  const [isEditing, setIsEditing] = useState<Partial<Competition> | null>(null);
  const [selectedType, setSelectedType] = useState<string>("DOMESTIC_LEAGUE");

  useEffect(() => {
    if (isEditing) {
      setSelectedType(isEditing.type || "DOMESTIC_LEAGUE");
    }
  }, [isEditing]);

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
      const [{ data: comps }, { data: cntrs }] = await Promise.all([
        api.get<Competition[]>("/admin/competitions"),
        api.get<Country[]>("/admin/countries"),
      ]);
      setCompetitions(comps);
      setCountries(cntrs);
      setSelectedCompetitionIds([]);
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
    const payload: any = {
      name: formData.get("name") as string,
      type: formData.get("type") as string,
      tier: formData.get("tier") ? Number(formData.get("tier")) : null,
    };

    if (["DOMESTIC_LEAGUE", "DOMESTIC_CUP", "DOMESTIC_SUPER_CUP"].includes(payload.type)) {
      payload.countryCode = (formData.get("countryCode") as string) || null;
      payload.region = null;
    } else {
      payload.countryCode = null;
      payload.region = (formData.get("region") as string) || null;
    }

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

  const handleBulkDelete = async () => {
    if (selectedCompetitionIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedCompetitionIds.length} selected competitions?`)) return;
    setError("");
    try {
      await Promise.all(selectedCompetitionIds.map(id => api.delete(`/admin/competitions/${id}`)));
      setSelectedCompetitionIds([]);
      fetchCompetitions();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const toggleCompetitionSelection = (id: string) => {
    setSelectedCompetitionIds(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

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
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="DOMESTIC_LEAGUE" className="bg-slate-900">Domestic League</option>
                  <option value="DOMESTIC_CUP" className="bg-slate-900">Domestic Cup</option>
                  <option value="CONTINENTAL_CLUB_COMPETITION" className="bg-slate-900">Continental Club Competition</option>
                  <option value="INTERNATIONAL_TOURNAMENT" className="bg-slate-900">International Tournament</option>
                  <option value="GLOBAL_CLUB_CHAMPIONSHIP" className="bg-slate-900">Global Club Championship</option>
                  <option value="DOMESTIC_SUPER_CUP" className="bg-slate-900">Domestic Super Cup</option>
                  <option value="CONTINENTAL_SUPER_CUP" className="bg-slate-900">Continental Super Cup</option>
                </select>
              </div>
              {[ "DOMESTIC_LEAGUE", "DOMESTIC_CUP", "DOMESTIC_SUPER_CUP" ].includes(selectedType) ? (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">Country</label>
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
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">Region</label>
                  <select
                    name="region"
                    defaultValue={isEditing.region || "EUROPE"}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="EUROPE" className="bg-slate-900">Europe</option>
                    <option value="AFRICA" className="bg-slate-900">Africa</option>
                    <option value="ASIA" className="bg-slate-900">Asia</option>
                    <option value="NORTH_AMERICA" className="bg-slate-900">North America</option>
                    <option value="SOUTH_AMERICA" className="bg-slate-900">South America</option>
                    <option value="OCEANIA" className="bg-slate-900">Oceania</option>
                    {[ "INTERNATIONAL_TOURNAMENT", "GLOBAL_CLUB_CHAMPIONSHIP" ].includes(selectedType) && (
                      <option value="WORLD" className="bg-slate-900">World</option>
                    )}
                  </select>
                </div>
              )}
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

      <div className="mb-6 flex items-center justify-between">
        <div className="w-64">
          <FilterSelect
            value={filterCompCountryCode}
            onChange={setFilterCompCountryCode}
            options={[
              { value: "_WORLD", label: "World (International)", group: "Global" },
              { value: "_CONTINENTAL", label: "Continental", group: "Global" },
              ...countries.map(c => ({ value: c.id, label: c.name, group: "Nations" }))
            ]}
            placeholder="League Country"
          />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 pl-2">
            <span className="font-bold text-white">{selectedCompetitionIds.length}</span> selected
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedCompetitionIds.length > 0 && (
            <button
              onClick={() => setSelectedCompetitionIds([])}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleBulkDelete}
            disabled={selectedCompetitionIds.length === 0}
            className={`rounded-xl px-5 py-2 text-sm font-bold transition ${
              selectedCompetitionIds.length > 0 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' 
                : 'bg-white/5 text-slate-500 border border-transparent cursor-not-allowed'
            }`}
          >
            Delete Selected
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-white/[0.06] bg-white/[0.02]">
              <tr>
                <th className="px-5 py-4 w-12"></th>
                <th className="px-5 py-4 font-semibold text-slate-300">Name</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Type</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Location</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Tier</th>
                <th className="px-5 py-4 font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {competitions
                .filter(c => {
                  if (!filterCompCountryCode) return true;
                  if (filterCompCountryCode === "_WORLD") return c.type === "INTERNATIONAL_TOURNAMENT" || c.type === "GLOBAL_CLUB_CHAMPIONSHIP";
                  if (filterCompCountryCode === "_CONTINENTAL") return c.type === "CONTINENTAL_CLUB_COMPETITION" || c.type === "CONTINENTAL_SUPER_CUP";
                  return c.countryCode === filterCompCountryCode;
                })
                .map((comp) => (
                <tr 
                  key={comp.id} 
                  onClick={() => toggleCompetitionSelection(comp.id)}
                  className={`transition cursor-pointer ${selectedCompetitionIds.includes(comp.id) ? 'bg-blue-500/10' : 'hover:bg-white/[0.02]'}`}
                >
                  <td className="px-5 py-4 text-center">
                    <input 
                      type="checkbox"
                      checked={selectedCompetitionIds.includes(comp.id)}
                      readOnly
                      className="rounded border-white/20 bg-black/40 text-blue-500 w-4 h-4 focus:ring-blue-500/50 focus:ring-offset-0 transition pointer-events-none"
                    />
                  </td>
                  <td className="px-5 py-4 font-medium text-white">{comp.name}</td>
                  <td className="px-5 py-4 text-slate-400">{comp.type}</td>
                  <td className="px-5 py-4 text-slate-300">{comp.countryCode || comp.region || "-"}</td>
                  <td className="px-5 py-4 text-slate-300">{comp.tier || "-"}</td>
                  <td className="px-5 py-4 flex justify-end gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsEditing(comp); }}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(comp.id); }}
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
