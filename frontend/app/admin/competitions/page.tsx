"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { ArrowLeft, Search, X, Trash2 } from "lucide-react";
import { api, extractApiErrorMessage } from "@/lib/api";
import { FilterSelect } from "@/components/filter-select";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { Modal } from "@/components/modal";
import { ConfirmModal } from "@/components/confirm-modal";

type Competition = {
  id: string;
  name: string;
  type: string;
  countryCode: string | null;
  region: string | null;
  tier: number | null;
  createdAt: string;
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
  const [confirmDelete, setConfirmDelete] = useState<{ id?: string, bulk?: boolean, count?: number } | null>(null);

  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

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
    const loadCountries = async () => {
      try {
        const { data } = await api.get<Country[]>("/admin/countries");
        setCountries(data);
      } catch (err) {
        console.error(err);
      }
    };
    loadCountries();
  }, [bootstrapped, user, router]);

  useEffect(() => {
    if (!bootstrapped || !user || user.role !== "ADMIN") return;
    fetchCompetitions();
  }, [bootstrapped, user, filterCompCountryCode, search, page, sort, order]);

  useEffect(() => {
    const delay = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(delay);
  }, [searchInput]);

  const fetchCompetitions = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 50 };
      if (filterCompCountryCode) {
        if (filterCompCountryCode === "_WORLD") params.countryCode = "_WORLD";
        else if (filterCompCountryCode === "_CONTINENTAL") params.countryCode = "_CONTINENTAL";
        else params.countryCode = filterCompCountryCode;
      }
      if (search) params.search = search;
      if (sort) params.sort = sort;
      if (order) params.order = order;
      
      const { data } = await api.get<{data: Competition[], meta: any}>("/admin/competitions", { params });
      setCompetitions(data.data);
      setMeta(data.meta);
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
    setError("");
    try {
      await api.delete(`/admin/competitions/${id}`);
      fetchCompetitions();
      setConfirmDelete(null);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCompetitionIds.length === 0) return;
    setError("");
    try {
      await Promise.all(selectedCompetitionIds.map(id => api.delete(`/admin/competitions/${id}`)));
      setSelectedCompetitionIds([]);
      fetchCompetitions();
      setConfirmDelete(null);
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
        <Modal 
          isOpen={!!isEditing} 
          onClose={() => setIsEditing(null)} 
          title={isEditing.id ? "Edit Competition" : "New Competition"}
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
                Save Competition
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className="mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[16rem]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search competitions..."
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
          <div className="w-64">
            <FilterSelect
              value={filterCompCountryCode}
              onChange={(val) => { setFilterCompCountryCode(val); setPage(1); }}
              options={[
                { value: "_WORLD", label: "World (International)", group: "Global" },
                { value: "_CONTINENTAL", label: "Continental", group: "Global" },
                ...countries.map(c => ({ value: c.id, label: c.name, group: "Nations" }))
              ]}
              placeholder="League Country"
            />
          </div>
        </div>
        <div className="text-sm text-slate-400 shrink-0">
          <span className="font-bold text-white">{meta.total}</span> competitions found
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-white/[0.06] bg-white/[0.02]">
              <tr>
                <th className="px-5 py-4 w-12"></th>
                <SortHeader label="Name" field="name" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <SortHeader label="Type" field="type" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <SortHeader label="Location" field="location" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <SortHeader label="Tier" field="tier" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <SortHeader label="Date Entered" field="createdAt" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
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
                  <td className="px-5 py-4 text-slate-400 text-xs">
                    {new Date(comp.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 flex justify-end gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsEditing(comp); }}
                      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: comp.id }); }}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {competitions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No competitions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-4 border-t border-white/[0.06]">
          {selectedCompetitionIds.length > 0 && (
            <button
              onClick={() => setConfirmDelete({ bulk: true, count: selectedCompetitionIds.length })}
              className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedCompetitionIds.length})
            </button>
          )}
          <Pagination 
            currentPage={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.total}
            onPageChange={setPage}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Deletion"
        message={confirmDelete?.bulk ? `Are you sure you want to delete ${confirmDelete.count} selected competitions? This action cannot be undone.` : "Are you sure you want to delete this competition? This action cannot be undone."}
        onConfirm={() => {
          if (confirmDelete?.bulk) {
            handleBulkDelete();
          } else if (confirmDelete?.id) {
            handleDelete(confirmDelete.id);
          }
        }}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
}
