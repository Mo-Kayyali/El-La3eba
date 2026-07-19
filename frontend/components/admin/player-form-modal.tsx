"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Check, Plus } from "lucide-react";
import { api, extractApiErrorMessage } from "@/lib/api";
import { FilterSelect } from "@/components/filter-select";
import { Modal } from "@/components/modal";

export type Club = {
  id: string;
  name: string;
  countryCode: string;
  currentCompetitionId?: string | null;
  clubCompetitions?: { competitionId: string }[];
};

export type Competition = {
  id: string;
  name: string;
  type?: string;
  countryCode: string | null;
};

export type Country = {
  id: string;
  name: string;
};

export type PlayerClubHistory = {
  clubId: string;
  startYear?: number | null;
  endYear?: number | null;
  isCurrent: boolean;
};

export type Player = {
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
  createdAt: string;
  currentClub?: Club | null;
  playerClubs?: { club: Club; startYear: number | null; endYear: number | null; isCurrent: boolean }[];
};

export const POSITIONS = [
  "GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"
];

interface PlayerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (player?: Player) => void;
  initialData: Partial<Player> | null;
}

export function PlayerFormModal({ isOpen, onClose, onSuccess, initialData }: PlayerFormModalProps) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);
  const [error, setError] = useState("");

  const [clubHistory, setClubHistory] = useState<PlayerClubHistory[]>([]);
  const [isRetiredState, setIsRetiredState] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [primaryPosition, setPrimaryPosition] = useState<string>("");
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [selectedNationality, setSelectedNationality] = useState<string>("");

  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const aliasesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && clubs.length === 0) {
      fetchDependencies();
    }
  }, [isOpen]);

  const fetchDependencies = async () => {
    try {
      setLoadingDeps(true);
      const [clubsRes, countriesRes, competitionsRes] = await Promise.all([
        api.get<{data: Club[]}>("/admin/clubs", { params: { limit: 10000 } }),
        api.get<Country[]>("/admin/countries"),
        api.get<{data: Competition[]}>("/admin/competitions", { params: { limit: 1000 } }),
      ]);
      setClubs(clubsRes.data.data);
      setCountries(countriesRes.data);
      setCompetitions(competitionsRes.data.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load dropdown dependencies.");
    } finally {
      setLoadingDeps(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError("");
      if (initialData) {
        setIsRetiredState(initialData.isRetired || false);
        setSelectedPositions(initialData.positions || []);
        setPrimaryPosition(initialData.primaryPosition || "");
        setSelectedClubId(initialData.currentClubId || "");
        setSelectedNationality(initialData.nationality || "");
        
        if (initialData.currentClubId && clubs.length > 0) {
          const club = clubs.find(c => c.id === initialData.currentClubId);
          setSelectedCompId(club?.currentCompetitionId || "");
        } else {
          setSelectedCompId("");
        }

        setClubHistory(
          (initialData.playerClubs || []).map(pc => ({
            clubId: pc.club.id,
            startYear: pc.startYear,
            endYear: pc.endYear,
            isCurrent: pc.isCurrent
          }))
        );
      } else {
        setIsRetiredState(false);
        setSelectedPositions([]);
        setPrimaryPosition("");
        setSelectedClubId("");
        setSelectedCompId("");
        setSelectedNationality("");
        setClubHistory([]);
      }
    }
  }, [isOpen, initialData, clubs]);

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

  const formClubOptions = getGroupedClubOptions(selectedCompId);
  const allClubOptions = getGroupedClubOptions();

  const togglePosition = (pos: string) => {
    let newPositions: string[];
    const isAdding = !selectedPositions.includes(pos);
    
    if (isAdding) {
      newPositions = [...selectedPositions, pos];
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

  const handleClubChange = (clubId: string) => {
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
      if (initialData?.id) {
        const { data } = await api.patch(`/admin/players/${initialData.id}`, payload);
        onSuccess(data);
      } else {
        const { data } = await api.post("/admin/players", payload);
        onSuccess(data);
      }
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialData?.id ? "Edit Player" : "New Player"}
    >
      <form onSubmit={handleSave} className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Core Information */}
          <div className="space-y-4 md:col-span-2 grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1 space-y-1.5 mt-4">
              <label className="text-xs font-semibold text-slate-300">First Name</label>
              <input
                name="firstName"
                ref={firstNameRef}
                defaultValue={initialData?.firstName || ""}
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
                defaultValue={initialData?.lastName || ""}
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
                defaultValue={initialData?.name || ""}
                className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Aliases (comma separated)</label>
              <input
                name="aliases"
                ref={aliasesRef}
                defaultValue={initialData?.aliases?.join(", ") || ""}
                placeholder="Enter aliases"
                className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
            
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Nationality</label>
              <input type="hidden" name="nationality" value={selectedNationality} />
              <FilterSelect
                value={selectedNationality}
                onChange={(val) => setSelectedNationality(val)}
                options={countries.map(c => ({ value: c.id, label: `${c.name} (${c.id})` }))}
                placeholder="Select Nationality..."
              />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Competition Filter</label>
              <div className={isRetiredState ? "opacity-50 pointer-events-none" : ""}>
                <FilterSelect
                  value={selectedCompId}
                  onChange={(val) => setSelectedCompId(val)}
                  options={getGroupedCompOptions}
                  placeholder="Select Competition"
                />
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Current Club</label>
              <div className={isRetiredState ? "opacity-50 pointer-events-none" : ""}>
                <FilterSelect
                  value={selectedClubId}
                  onChange={handleClubChange}
                  options={formClubOptions}
                  placeholder="None / Free Agent"
                />
              </div>
              <input type="hidden" name="currentClubId" value={selectedClubId} />
            </div>

            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Date of Birth</label>
              <input
                name="dateOfBirth"
                type="date"
                defaultValue={initialData?.dateOfBirth ? new Date(initialData.dateOfBirth).toISOString().split('T')[0] : ""}
                className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Height (cm)</label>
              <input
                name="heightCm"
                type="number"
                defaultValue={initialData?.heightCm || ""}
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
                defaultValue={initialData?.preferredFoot || ""}
                className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="" className="bg-slate-900">Unknown</option>
                <option value="RIGHT" className="bg-slate-900">Right</option>
                <option value="LEFT" className="bg-slate-900">Left</option>
                <option value="BOTH" className="bg-slate-900">Both</option>
              </select>
            </div>

          </div>

          {/* Full Width Footer */}
          <div className="md:col-span-3 space-y-6 pt-2">
            <div>
              <label className={`flex items-center gap-4 cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all ${isRetiredState ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_20px_-5px_rgba(239,68,68,0.2)]' : 'bg-black/40 border-white/[0.08] hover:border-white/20'}`}>
                <div className={`flex items-center justify-center w-6 h-6 shrink-0 rounded-md border transition-colors ${isRetiredState ? 'bg-red-500 border-red-500 text-white' : 'border-white/20 bg-black/60'}`}>
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
                <div className="flex-1">
                  <div className={`font-bold text-base ${isRetiredState ? 'text-red-400' : 'text-slate-300'}`}>Player is Retired</div>
                  <div className="text-xs sm:text-sm text-slate-500 mt-1">Disables current club assignments and marks player as inactive in current team rosters.</div>
                </div>
              </label>
            </div>

            <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Image URL</label>
            <input
              name="imageUrl"
              defaultValue={initialData?.imageUrl || ""}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
            />
            </div>
          </div>

          {/* Club History Sub-section */}
          <div className="md:col-span-3 pt-6 border-t border-white/[0.06]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white">Club History</h3>
              <button
                type="button"
                onClick={addClubHistory}
                className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20"
              >
                <Plus className="h-3 w-3" />
                Add Record
              </button>
            </div>
            <div className="space-y-3">
              {clubHistory.map((history, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                  <div className="flex-1 min-w-[200px]">
                    <FilterSelect
                      value={history.clubId}
                      onChange={(val) => updateClubHistory(idx, 'clubId', val)}
                      options={allClubOptions}
                      placeholder="Select Club..."
                      menuPlacement="top"
                    />
                  </div>
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
        
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500 transition"
          >
            <Check className="h-4 w-4" /> Save Player
          </button>
        </div>
      </form>
    </Modal>
  );
}
