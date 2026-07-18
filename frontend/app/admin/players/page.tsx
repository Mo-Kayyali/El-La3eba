"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { ArrowLeft, Check, Search, X } from "lucide-react";
import { api, extractApiErrorMessage } from "@/lib/api";
import { FilterSelect } from "@/components/filter-select";
import { Pagination } from "@/components/pagination";

type Club = {
  id: string;
  name: string;
  countryCode: string;
  currentCompetitionId?: string | null;
  clubCompetitions?: { competitionId: string }[];
};

type Competition = {
  id: string;
  name: string;
  type?: string;
  countryCode: string | null;
};

type Country = {
  id: string;
  name: string;
};

type PlayerClubHistory = {
  clubId: string;
  startYear?: number | null;
  endYear?: number | null;
  isCurrent: boolean;
};

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  aliases: string[];
  nationality: string;
  dateOfBirth: string | null;
  heightCm: number | null;
  preferredFoot: "LEFT" | "RIGHT" | "BOTH" | null;
  positions: string[];
  primaryPosition: string | null;
  isRetired: boolean;
  currentClubId: string | null;
  imageUrl: string | null;
  currentClub?: Club | null;
  playerClubs?: { club: Club; startYear: number | null; endYear: number | null; isCurrent: boolean }[];
};

const POSITIONS = [
  "GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"
];

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

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState<Partial<Player> | null>(null);
  const [clubHistory, setClubHistory] = useState<any[]>([]);
  const [isRetiredState, setIsRetiredState] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [primaryPosition, setPrimaryPosition] = useState<string>("");
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [filterCompId, setFilterCompId] = useState<string>("");
  const [filterClubId, setFilterClubId] = useState<string>("");
  const [filterRetired, setFilterRetired] = useState<string>("");
  const [filterNationality, setFilterNationality] = useState<string>("");

  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const aliasesRef = useRef<HTMLInputElement>(null);

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
  }, [page, search, filterNationality, filterCompId, filterClubId, filterRetired]);

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
      setIsRetiredState(data.isRetired || false);
      setSelectedPositions(data.positions || []);
      setPrimaryPosition(data.primaryPosition || "");
      setSelectedClubId(data.currentClubId || "");
      if (data.currentClubId) {
        // Find club in current list (even if clubs isn't updated, handleEdit uses current state scope)
        const club = clubs.find(c => c.id === data.currentClubId);
        setSelectedCompId(club?.currentCompetitionId || "");
      } else {
        setSelectedCompId("");
      }
      setClubHistory(
        (data.playerClubs || []).map(pc => ({
          clubId: pc.club.id,
          startYear: pc.startYear,
          endYear: pc.endYear,
          isCurrent: pc.isCurrent
        }))
      );
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleCreateNew = () => {
    setIsEditing({ isRetired: false });
    setIsRetiredState(false);
    setSelectedPositions([]);
    setPrimaryPosition("");
    setSelectedClubId("");
    setSelectedCompId("");
    setClubHistory([]);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    let firstName = (formData.get("firstName") as string).trim();
    let lastName = (formData.get("lastName") as string).trim();
    let name = (formData.get("name") as string).trim();

    const aliasesRaw = formData.get("aliases") as string;
    let aliases = aliasesRaw ? aliasesRaw.split(",").map(s => s.trim()).filter(Boolean) : [];
    
    const payload = {
      firstName,
      lastName,
      name,
      aliases: aliases.length > 0 ? aliases : undefined,
      nationality: formData.get("nationality") as string,
      currentClubId: (formData.get("currentClubId") as string) || null,
      primaryPosition: primaryPosition || null,
      positions: selectedPositions,
      preferredFoot: (formData.get("preferredFoot") as string) || null,
      isRetired: formData.get("isRetired") === "on",
      heightCm: formData.get("heightCm") ? Number(formData.get("heightCm")) : undefined,
      dateOfBirth: (formData.get("dateOfBirth") as string) ? new Date(formData.get("dateOfBirth") as string).toISOString() : undefined,
      imageUrl: (formData.get("imageUrl") as string) || null,
      clubHistory: clubHistory.map(h => ({
        ...h,
        startYear: h.startYear ? Number(h.startYear) : null,
        endYear: h.endYear ? Number(h.endYear) : null,
      }))
    };

    try {
      if (isEditing?.id) {
        await api.patch(`/admin/players/${isEditing.id}`, payload);
      } else {
        await api.post("/admin/players", payload);
      }
      setIsEditing(null);
      fetchPlayers();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    setError("");
    try {
      await api.delete(`/admin/players/${id}`);
      fetchPlayers();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPlayerIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPlayerIds.length} selected players?`)) return;
    setError("");
    try {
      await Promise.all(selectedPlayerIds.map(id => api.delete(`/admin/players/${id}`)));
      setSelectedPlayerIds([]);
      fetchPlayers();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const togglePlayerSelection = (id: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const togglePosition = (pos: string) => {
    let newPositions: string[];
    const isAdding = !selectedPositions.includes(pos);
    
    if (isAdding) {
      newPositions = [...selectedPositions, pos];
      // 3. AUTO-PRIMARY-POSITION
      if (newPositions.length === 1) {
        setPrimaryPosition(pos);
      } else if (newPositions.length > 1 && !primaryPosition) {
        setPrimaryPosition(newPositions[0]);
      }
    } else {
      newPositions = selectedPositions.filter(p => p !== pos);
      if (primaryPosition === pos) {
        setPrimaryPosition("");
      }
    }
    setSelectedPositions(newPositions);
  };

  const handleClubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clubId = e.target.value;
    setSelectedClubId(clubId);
    if (clubId && !selectedCompId) {
      const club = clubs.find(c => c.id === clubId);
      if (club && club.currentCompetitionId) {
        setSelectedCompId(club.currentCompetitionId);
      }
    }
  };



  const addClubHistory = () => {
    setClubHistory([...clubHistory, { clubId: "", isCurrent: false }]);
  };

  const updateClubHistory = (index: number, field: keyof PlayerClubHistory, value: any) => {
    const newHistory = [...clubHistory];
    newHistory[index] = { ...newHistory[index], [field]: value };
    setClubHistory(newHistory);
  };

  const removeClubHistory = (index: number) => {
    setClubHistory(clubHistory.filter((_, i) => i !== index));
  };

  if (!bootstrapped || loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-slate-200">
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
        <button
          onClick={handleCreateNew}
          className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-300 hover:bg-violet-500/20 transition"
        >
          Add Player
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isEditing && (
        <div className="mb-8 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-xl">
          <h2 className="mb-6 text-xl font-bold text-white">
            {isEditing.id ? "Edit Player" : "New Player"}
          </h2>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Core Information */}
              <div className="space-y-4 md:col-span-2 grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1 space-y-1.5 mt-4">
                  <label className="text-xs font-semibold text-slate-300">First Name</label>
                  <input
                    name="firstName"
                    ref={firstNameRef}
                    defaultValue={isEditing.firstName || ""}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1.5 mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">Last Name</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (nameRef.current && firstNameRef.current && lastNameRef.current) {
                          const parts = nameRef.current.value.trim().split(/\s+/);
                          if (parts.length > 0 && parts[0] !== "") {
                            firstNameRef.current.value = parts[0];
                            lastNameRef.current.value = parts.length > 1 ? parts[parts.length - 1] : "";
                          }
                        }
                      }}
                      className="text-[10px] uppercase tracking-wider font-bold text-violet-400 hover:text-violet-300 transition whitespace-nowrap ml-2"
                    >
                      Auto-fill from Display
                    </button>
                  </div>
                  <input
                    name="lastName"
                    ref={lastNameRef}
                    defaultValue={isEditing.lastName || ""}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">Display Name</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (firstNameRef.current && lastNameRef.current && nameRef.current) {
                          nameRef.current.value = `${firstNameRef.current.value.trim()} ${lastNameRef.current.value.trim()}`.trim();
                        }
                      }}
                      className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 hover:text-emerald-300 transition"
                    >
                      Auto-fill from First/Last
                    </button>
                  </div>
                  <input
                    name="name"
                    ref={nameRef}
                    defaultValue={isEditing.name || ""}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Aliases (comma separated)</label>
                  <input
                    name="aliases"
                    ref={aliasesRef}
                    defaultValue={isEditing.aliases?.join(", ") || ""}
                    placeholder="Enter aliases"
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Nationality</label>
                  <input
                    name="nationality"
                    list="countries-list"
                    defaultValue={isEditing.nationality || ""}
                    required
                    placeholder="Type code or search name..."
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                  <datalist id="countries-list">
                    {countries.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                  </datalist>
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Competition Filter</label>
                  <select
                    value={selectedCompId}
                    onChange={e => setSelectedCompId(e.target.value)}
                    disabled={isRetiredState}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" className="bg-slate-900">All Clubs</option>
                    {competitions.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900">
                        {c.name} {c.countryCode ? `(${c.countryCode})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Current Club</label>
                  <select
                    name="currentClubId"
                    value={selectedClubId}
                    onChange={handleClubChange}
                    disabled={isRetiredState}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" className="bg-slate-900">None / Free Agent</option>
                    {clubs
                      .filter(c => !selectedCompId || c.currentCompetitionId === selectedCompId || c.clubCompetitions?.some(cc => cc.competitionId === selectedCompId))
                      .map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Date of Birth</label>
                  <input
                    name="dateOfBirth"
                    type="date"
                    defaultValue={isEditing.dateOfBirth ? new Date(isEditing.dateOfBirth).toISOString().split('T')[0] : ""}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Height (cm)</label>
                  <input
                    name="heightCm"
                    type="number"
                    defaultValue={isEditing.heightCm || ""}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-4 md:border-l md:border-white/[0.06] md:pl-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Primary Position</label>
                  <select
                    name="primaryPosition"
                    value={primaryPosition}
                    onChange={(e) => setPrimaryPosition(e.target.value)}
                    disabled={selectedPositions.length === 0}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedPositions.length === 0 ? (
                      <option value="" disabled className="bg-slate-900">Select positions first...</option>
                    ) : (
                      <>
                        <option value="" className="bg-slate-900">None</option>
                        {selectedPositions.map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                      </>
                    )}
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">All Positions</label>
                  <div className="flex flex-wrap gap-2">
                    {POSITIONS.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePosition(p)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${selectedPositions.includes(p) ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Preferred Foot</label>
                  <select
                    name="preferredFoot"
                    defaultValue={isEditing.preferredFoot || ""}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="" className="bg-slate-900">Unknown</option>
                    <option value="RIGHT" className="bg-slate-900">Right</option>
                    <option value="LEFT" className="bg-slate-900">Left</option>
                    <option value="BOTH" className="bg-slate-900">Both</option>
                  </select>
                </div>

                <div className="pt-4">
                  <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-xl border transition-all ${isRetiredState ? 'bg-red-500/10 border-red-500/30' : 'bg-black/40 border-white/[0.08] hover:border-white/20'}`}>
                    <div className={`flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${isRetiredState ? 'bg-red-500 border-red-500 text-white' : 'border-white/20 bg-black/60'}`}>
                      {isRetiredState && <Check className="w-4 h-4 stroke-[3px]" />}
                    </div>
                    <input
                      type="checkbox"
                      name="isRetired"
                      checked={isRetiredState}
                      onChange={(e) => {
                        const isRetired = e.target.checked;
                        setIsRetiredState(isRetired);
                        if (isRetired) {
                          setSelectedClubId("");
                          setSelectedCompId("");
                          setClubHistory(prev => prev.map(h => ({ ...h, isCurrent: false })));
                        }
                      }}
                      className="hidden"
                    />
                    <div>
                      <div className={`font-bold text-sm ${isRetiredState ? 'text-red-400' : 'text-slate-300'}`}>Player is Retired</div>
                      <div className="text-xs text-slate-500 mt-0.5">Disables current club assignments and marks player as inactive</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Full Width Footer */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Image URL</label>
                <input
                  name="imageUrl"
                  defaultValue={isEditing.imageUrl || ""}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>

              {/* Club History Sub-section */}
              <div className="md:col-span-3 pt-6 border-t border-white/[0.06]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-white">Club History</h3>
                  <button
                    type="button"
                    onClick={addClubHistory}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
                  >
                    + Add Record
                  </button>
                </div>
                <div className="space-y-3">
                  {clubHistory.map((history, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                      <select
                        required
                        value={history.clubId}
                        onChange={(e) => updateClubHistory(idx, 'clubId', e.target.value)}
                        className="flex-1 min-w-[200px] rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                      >
                        <option value="" className="bg-slate-900" disabled>Select Club...</option>
                        {clubs.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
                      </select>
                      <input
                        type="number"
                        placeholder="Start Year"
                        value={history.startYear || ""}
                        onChange={(e) => updateClubHistory(idx, 'startYear', e.target.value)}
                        className="w-24 rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                      />
                      <input
                        type="number"
                        placeholder="End Year"
                        disabled={history.isCurrent}
                        value={history.isCurrent ? "" : (history.endYear || "")}
                        onChange={(e) => updateClubHistory(idx, 'endYear', e.target.value)}
                        className="w-24 rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 disabled:opacity-50"
                      />
                      <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${isRetiredState ? 'text-slate-500' : 'text-slate-300'}`}>
                        <input
                          type="checkbox"
                          checked={history.isCurrent}
                          disabled={isRetiredState}
                          onChange={(e) => updateClubHistory(idx, 'isCurrent', e.target.checked)}
                          className={`rounded border-white/20 bg-black/40 text-blue-500 w-3.5 h-3.5 ${isRetiredState ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        Current
                      </label>
                      <button
                        type="button"
                        onClick={() => removeClubHistory(idx)}
                        className="ml-auto text-xs font-bold text-red-400 hover:text-red-300 transition"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {clubHistory.length === 0 && (
                    <p className="text-xs text-slate-500 italic">No club history records.</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-6 mt-6 border-t border-white/[0.06]">
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95"
              >
                Save Player
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
                options={competitions
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
                  })}
                placeholder="All Leagues"
              />
            </div>
            <div className="min-w-[12rem] flex-1">
              <FilterSelect
                value={filterClubId}
                onChange={(val) => { setFilterClubId(val); setPage(1); }}
                options={clubs
                  .filter(c => !filterCompId || c.currentCompetitionId === filterCompId || c.clubCompetitions?.some(cc => cc.competitionId === filterCompId))
                  .map(c => ({ value: c.id, label: c.name }))}
                placeholder="All Clubs"
              />
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
          <button
            onClick={handleBulkDelete}
            disabled={selectedPlayerIds.length === 0}
            className={`rounded-xl px-5 py-2 text-sm font-bold transition ${
              selectedPlayerIds.length > 0 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' 
                : 'bg-white/5 text-slate-500 border border-transparent cursor-not-allowed'
            }`}
          >
            Delete Selected
          </button>
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
                <th className="px-5 py-4 font-semibold text-slate-300">Name</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Nationality</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Current Club</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Status</th>
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
                  <td className="px-5 py-4 flex justify-end gap-3 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(player); }}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(player.id); }}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
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
