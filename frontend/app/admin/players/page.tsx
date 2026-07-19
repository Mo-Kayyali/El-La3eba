"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { ArrowLeft, Check, Plus, Search, Trash2, X } from "lucide-react";
import { api, extractApiErrorMessage } from "@/lib/api";
import { FilterSelect } from "@/components/filter-select";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { ConfirmModal } from "@/components/confirm-modal";
import {
  PlayerFormModal,
  Player,
  Club,
  Competition,
  Country,
  PlayerClubHistory
} from "@/components/admin/player-form-modal";

import { Suspense } from "react";

function AdminPlayersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { user, bootstrapped } = useAuthStore();
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, page: 1 });
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id?: string, bulk?: boolean, count?: number } | null>(null);
  const [isEditing, setIsEditing] = useState<Partial<Player> | null>(null);
  const [filterCompId, setFilterCompId] = useState<string>("");
  const [filterClubId, setFilterClubId] = useState<string>("");
  const [filterRetired, setFilterRetired] = useState<string>("");
  const [filterNationality, setFilterNationality] = useState<string>("");

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
      const [clubsRes, countriesRes, competitionsRes] = await Promise.all([
        api.get<{data: Club[]}>("/admin/clubs", { params: { limit: 10000 } }),
        api.get<Country[]>("/admin/countries"),
        api.get<{data: Competition[]}>("/admin/competitions", { params: { limit: 1000 } }),
      ]);
      setClubs(clubsRes.data.data);
      setCountries(countriesRes.data);
      setCompetitions(competitionsRes.data.data);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!bootstrapped || !user || user.role !== "ADMIN") return;
    fetchPlayers();
  }, [bootstrapped, user, page, search, filterNationality, filterCompId, filterClubId, filterRetired, sort, order]);

  const getGroupedCompOptions = useMemo(() => {
    return competitions
      .map(c => {
        let group = "Other";
        if (c.type === "CONTINENTAL_CLUB_COMPETITION" || c.type === "CONTINENTAL_SUPER_CUP") group = "Continental";
        else if (c.type === "INTERNATIONAL_TOURNAMENT" || c.type === "GLOBAL_CLUB_CHAMPIONSHIP" || c.type === "INTERNATIONAL") group = "International";
        else if (c.countryCode) {
          group = countries.find(co => co.id === c.countryCode)?.name || c.countryCode;
        } else {
          group = "Domestic";
        }
        return { value: c.id, label: c.name, group };
      })
      .sort((a, b) => {
        if (a.group === "Continental") return -1;
        if (a.group === "International") return -1;
        if (b.group === "Continental") return 1;
        if (b.group === "International") return 1;
        return a.group.localeCompare(b.group) || a.label.localeCompare(b.label);
      });
  }, [competitions, countries]);

  useEffect(() => {
    const delay = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(delay);
  }, [searchInput]);

  const fetchPlayers = async () => {
    try {
      const params: any = { page, limit: 50 };
      if (filterCompId) params.competitionId = filterCompId;
      if (filterClubId) params.clubId = filterClubId;
      if (filterRetired) params.isRetired = filterRetired;
      if (filterNationality) params.nationality = filterNationality;
      if (search) params.search = search;
      if (sort) params.sort = sort;
      if (order) params.order = order;
      const { data } = await api.get<{data: Player[], meta: any}>("/admin/players", { params });
      setPlayers(data.data);
      setMeta(data.meta);
      setSelectedPlayerIds([]);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  useEffect(() => {
    if (editId && players.length > 0 && !isEditing) {
      const p = players.find(p => p.id === editId);
      if (p) {
        handleEdit(p);
      }
    }
  }, [editId, players]);

  const handleEdit = async (player: Player) => {
    try {
      const { data } = await api.get<Player>(`/admin/players/${player.id}`);
      setIsEditing(data);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleCreateNew = () => {
    setIsEditing({ isRetired: false });
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await api.delete(`/admin/players/${id}`);
      fetchPlayers();
      setConfirmDelete(null);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPlayerIds.length === 0) return;
    setError("");
    try {
      await Promise.all(selectedPlayerIds.map(id => api.delete(`/admin/players/${id}`)));
      setSelectedPlayerIds([]);
      fetchPlayers();
      setConfirmDelete(null);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const togglePlayerSelection = (id: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };



  if (!bootstrapped || loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 text-slate-200">
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
      <div className="mb-8 flex items-center justify-between border-b border-white/[0.06] pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Players</h1>
          <p className="mt-1 text-sm text-slate-400">Manage player profiles and club history.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPlayers()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 transition"
          >
            Refresh
          </button>
          <button
            onClick={handleCreateNew}
            className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-300 hover:bg-violet-500/20 transition"
          >
            Add Player
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <PlayerFormModal
        isOpen={!!isEditing}
        initialData={isEditing}
        onClose={() => {
          setIsEditing(null);
          if (editId) router.replace('/admin/players');
        }}
        onSuccess={() => {
          setIsEditing(null);
          if (editId) router.replace('/admin/players');
          fetchPlayers();
        }}
      />

      <div className="mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[12rem] flex-1">
              <FilterSelect
                value={filterNationality}
                onChange={(val) => { setFilterNationality(val); setPage(1); }}
                options={countries.map(c => ({ value: c.id, label: `${c.name} (${c.id})` }))}
                placeholder="All Nationalities"
              />
            </div>
            <div className="min-w-[12rem] flex-1">
              <FilterSelect
                value={filterCompId}
                onChange={(val) => {
                  setFilterCompId(val);
                  setFilterClubId(""); // Reset club when league changes
                  setPage(1);
                }}
                options={getGroupedCompOptions}
                placeholder="All Leagues"
              />
            </div>
            <div className="min-w-[12rem] flex-1">
              {(() => {
                const getGroupedClubOptions = (compIdToFilterBy?: string) => {
                  return clubs
                    .filter(c => !compIdToFilterBy || c.currentCompetitionId === compIdToFilterBy || c.clubCompetitions?.some(cc => cc.competitionId === compIdToFilterBy))
                    .map(c => {
                      let group = "Other";
                      if (c.currentCompetitionId) {
                        const comp = competitions.find(comp => comp.id === c.currentCompetitionId);
                        if (comp) group = comp.name;
                      } else if (c.countryCode) {
                        const country = countries.find(co => co.id === c.countryCode);
                        if (country) group = country.name;
                      }
                      return { value: c.id, label: c.name, group };
                    })
                    .sort((a, b) => {
                      if (a.group === "Other") return 1;
                      if (b.group === "Other") return -1;
                      return a.group.localeCompare(b.group) || a.label.localeCompare(b.label);
                    });
                };
                const filterClubOptions = getGroupedClubOptions(filterCompId);
                return (
                  <FilterSelect
                    value={filterClubId}
                    onChange={(val) => { setFilterClubId(val); setPage(1); }}
                    options={filterClubOptions}
                    placeholder="All Clubs"
                  />
                );
              })()}
            </div>
            <div className="min-w-[12rem] flex-1">
              <FilterSelect
                value={filterRetired}
                onChange={(val) => { setFilterRetired(val); setPage(1); }}
                options={[
                  { value: "false", label: "Active Only" },
                  { value: "true", label: "Retired Only" }
                ]}
                placeholder="All Statuses"
              />
            </div>
          </div>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search players..."
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
        </div>
        <div className="text-sm text-slate-400 shrink-0">
          <span className="font-bold text-white">{meta.total}</span> players found
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 pl-2">
            <span className="font-bold text-white">{selectedPlayerIds.length}</span> selected
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedPlayerIds.length > 0 && (
            <button
              onClick={() => setSelectedPlayerIds([])}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              Cancel
            </button>
          )}
          {/* Bulk Action Buttons */}
          {selectedPlayerIds.length > 0 && (
            <button
              onClick={() => setConfirmDelete({ bulk: true, count: selectedPlayerIds.length })}
              className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedPlayerIds.length})
            </button>
          )}
        </div>
      </div>

      {players.length > 0 && (
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
                <SortHeader label="Nationality" field="nationality" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <SortHeader label="Current Club" field="currentClub" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <SortHeader label="Status" field="isRetired" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <SortHeader label="Date Entered" field="createdAt" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} />
                <th className="px-5 py-4 font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {players.map((player) => (
                <tr 
                  key={player.id} 
                  onClick={() => togglePlayerSelection(player.id)}
                  className={`transition cursor-pointer ${selectedPlayerIds.includes(player.id) ? 'bg-violet-500/10' : 'hover:bg-white/[0.02]'}`}
                >
                  <td className="px-5 py-4 text-center">
                    <input 
                      type="checkbox"
                      checked={selectedPlayerIds.includes(player.id)}
                      readOnly
                      className="rounded border-white/20 bg-black/40 text-violet-500 w-4 h-4 focus:ring-violet-500/50 focus:ring-offset-0 transition pointer-events-none"
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">{player.name}</div>
                    <div className="text-xs text-slate-500">{player.firstName} {player.lastName}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{player.nationality}</td>
                  <td className="px-5 py-4 text-slate-300">{player.currentClub?.name || "-"}</td>
                  <td className="px-5 py-4">
                    {player.isRetired ? (
                      <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/20">Retired</span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">Active</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs">
                    {new Date(player.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 flex justify-end gap-3 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(player); }}
                      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: player.id }); }}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No players found.
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

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Deletion"
        message={confirmDelete?.bulk ? `Are you sure you want to delete ${confirmDelete.count} selected players? This action cannot be undone.` : "Are you sure you want to delete this player? This action cannot be undone."}
        onConfirm={() => {
          if (confirmDelete?.bulk) {
            handleBulkDelete();
          } else if (confirmDelete?.id) {
            handleDelete(confirmDelete.id);
          }
          setConfirmDelete(null);
        }}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
}

export default function AdminPlayersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading...</div>}>
      <AdminPlayersContent />
    </Suspense>
  );
}
