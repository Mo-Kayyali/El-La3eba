"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { ArrowLeft, Search, X } from "lucide-react";
import { api, extractApiErrorMessage } from "@/lib/api";
import { FilterSelect } from "@/components/filter-select";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { Modal } from "@/components/modal";

type Club = {
  id: string;
  name: string;
  aliases: string[];
  countryCode: string | null;
  currentCompetitionId: string | null;
  logoUrl: string | null;
  createdAt: string;
  clubCompetitions?: { competitionId: string }[];
};

type Competition = {
  id: string;
  name: string;
  type?: string;
  countryCode?: string | null;
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
  const [filterCountryCode, setFilterCountryCode] = useState<string>("");
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);
  
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, page: 1 });
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

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
      const [compsRes, countriesRes] = await Promise.all([
        api.get<{data: Competition[]}>("/admin/competitions", { params: { limit: 1000 } }),
        api.get<Country[]>("/admin/countries"),
      ]);
      setCompetitions(compsRes.data.data);
      setCountries(countriesRes.data);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!bootstrapped || !user || user.role !== "ADMIN") return;
    fetchClubs();
  }, [page, search, filterCountryCode, filterCompId, sort, order]);

  useEffect(() => {
    const delay = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(delay);
  }, [searchInput]);

  const fetchClubs = async () => {
    try {
      const params: any = { page, limit: 50 };
      if (filterCompId) params.competitionId = filterCompId;
      if (filterCountryCode) params.countryCode = filterCountryCode;
      if (search) params.search = search;
      if (sort) params.sort = sort;
      if (order) params.order = order;
      
      const { data } = await api.get<{data: Club[], meta: any}>("/admin/clubs", { params });
      setClubs(data.data);
      setMeta(data.meta);
      setSelectedClubIds([]);
    } catch (err) {
      setError(extractApiErrorMessage(err));
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
      fetchClubs();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    setError("");
    try {
      await api.delete(`/admin/clubs/${id}`);
      fetchClubs();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedClubIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedClubIds.length} selected clubs?`)) return;
    setError("");
    try {
      await Promise.all(selectedClubIds.map(id => api.delete(`/admin/clubs/${id}`)));
      setSelectedClubIds([]);
      fetchClubs();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const toggleClubSelection = (id: string) => {
    setSelectedClubIds(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
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

  const filteredClubs = clubs;

  const groupedCompetitions = competitions.reduce((acc, comp) => {
    let groupName = "Other";
    if (comp.type === "CONTINENTAL_CLUB") groupName = "Continental";
    else if (comp.type === "INTERNATIONAL") groupName = "International";
    else if (comp.countryCode) {
      const cName = countries.find(c => c.id === comp.countryCode)?.name || comp.countryCode;
      groupName = cName;
    } else {
      groupName = "Domestic";
    }
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(comp);
    return acc;
  }, {} as Record<string, Competition[]>);

  const sortedGroups = Object.keys(groupedCompetitions).sort((a, b) => {
    if (a === "Continental") return -1;
    if (a === "International") return -1;
    if (b === "Continental") return 1;
    if (b === "International") return 1;
    return a.localeCompare(b);
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

      <div className="mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[16rem]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search clubs..."
              className="h-[42px] w-full rounded-xl border border-white/[0.08] bg-black/40 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:outline-none transition"
            />
            {search && (
              <button 
                onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="w-48">
            <FilterSelect
              value={filterCountryCode}
              onChange={(val) => { setFilterCountryCode(val); setPage(1); }}
              options={countries.map(c => ({ value: c.id, label: `${c.name} (${c.id})` }))}
              placeholder="All Countries"
            />
          </div>
          <div className="w-64">
            <FilterSelect
              value={filterCompId}
              onChange={(val) => { setFilterCompId(val); setPage(1); }}
              options={sortedGroups.flatMap(group => 
                groupedCompetitions[group].map(c => ({ value: c.id, label: c.name, group }))
              )}
              placeholder="All Competitions"
            />
          </div>
        </div>
        <div className="text-sm text-slate-400 shrink-0">
          <span className="font-bold text-white">{meta.total}</span> clubs found
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 pl-2">
            <span className="font-bold text-white">{selectedClubIds.length}</span> selected
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedClubIds.length > 0 && (
            <button
              onClick={() => setSelectedClubIds([])}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleBulkDelete}
            disabled={selectedClubIds.length === 0}
            className={`rounded-xl px-5 py-2 text-sm font-bold transition ${
              selectedClubIds.length > 0 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' 
                : 'bg-white/5 text-slate-500 border border-transparent cursor-not-allowed'
            }`}
          >
            Delete Selected
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isEditing && (
        <Modal 
          isOpen={!!isEditing} 
          onClose={() => setIsEditing(null)} 
          title={isEditing.id ? "Edit Club" : "New Club"}
        >
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
                  {sortedGroups.map((group) => (
                    <optgroup key={group} label={group}>
                      {groupedCompetitions[group].map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
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
                    {sortedGroups.map((group) => {
                      const available = groupedCompetitions[group].filter((c) => !selectedComps.includes(c.id));
                      if (available.length === 0) return null;
                      return (
                        <optgroup key={group} label={group}>
                          {available.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
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
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
              <button
                type="button"
                onClick={() => setIsEditing(null)}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500 transition"
              >
                Save Club
              </button>
            </div>
          </form>
        </Modal>
      )}

      {clubs.length > 0 && (
        <div className="mb-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl backdrop-blur-xl">
          <Pagination 
            currentPage={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.total}
            onPageChange={setPage}
          />
        </div>
      )}

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-white/[0.06] bg-white/[0.02]">
              <tr>
                <th className="px-5 py-4 w-12"></th>
                <SortHeader label="Name" field="name" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <SortHeader label="Country" field="countryCode" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <th className="px-5 py-4 font-semibold text-slate-300">Aliases</th>
                <SortHeader label="Date Entered" field="createdAt" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <th className="px-5 py-4 font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredClubs.map((club) => (
                <tr 
                  key={club.id} 
                  onClick={() => toggleClubSelection(club.id)}
                  className={`transition cursor-pointer ${selectedClubIds.includes(club.id) ? 'bg-emerald-500/10' : 'hover:bg-white/[0.02]'}`}
                >
                  <td className="px-5 py-4 text-center">
                    <input 
                      type="checkbox"
                      checked={selectedClubIds.includes(club.id)}
                      readOnly
                      className="rounded border-white/20 bg-black/40 text-emerald-500 w-4 h-4 focus:ring-emerald-500/50 focus:ring-offset-0 transition pointer-events-none"
                    />
                  </td>
                  <td className="px-5 py-4 font-medium text-white">{club.name}</td>
                  <td className="px-5 py-4 text-slate-300">{club.countryCode}</td>
                  <td className="px-5 py-4 text-slate-400">
                    {club.aliases.length > 0 ? club.aliases.join(", ") : "-"}
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs">
                    {new Date(club.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 flex justify-end gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(club); }}
                      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(club.id); }}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClubs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No clubs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <Pagination 
          currentPage={meta.page}
          totalPages={meta.totalPages}
          totalItems={meta.total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
