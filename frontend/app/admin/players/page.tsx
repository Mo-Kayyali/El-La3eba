"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api, extractApiErrorMessage } from "@/lib/api";

type Club = {
  id: string;
  name: string;
  countryCode: string;
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

export default function AdminPlayersPage() {
  const router = useRouter();
  const { user, bootstrapped } = useAuthStore();
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isEditing, setIsEditing] = useState<Partial<Player> | null>(null);
  const [clubHistory, setClubHistory] = useState<PlayerClubHistory[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

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
      const [playersRes, clubsRes, countriesRes] = await Promise.all([
        api.get<Player[]>("/admin/players"),
        api.get<Club[]>("/admin/clubs"),
        api.get<Country[]>("/admin/countries"),
      ]);
      setPlayers(playersRes.data);
      setClubs(clubsRes.data);
      setCountries(countriesRes.data);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (player: Player) => {
    try {
      const { data } = await api.get<Player>(`/admin/players/${player.id}`);
      setIsEditing(data);
      setSelectedPositions(data.positions || []);
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
    setSelectedPositions([]);
    setClubHistory([]);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    const aliasesRaw = formData.get("aliases") as string;
    
    const payload = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      name: formData.get("name") as string,
      aliases: aliasesRaw ? aliasesRaw.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      nationality: formData.get("nationality") as string,
      currentClubId: (formData.get("currentClubId") as string) || null,
      primaryPosition: (formData.get("primaryPosition") as string) || null,
      positions: selectedPositions,
      preferredFoot: (formData.get("preferredFoot") as string) || null,
      isRetired: formData.get("isRetired") === "on",
      heightCm: formData.get("heightCm") ? Number(formData.get("heightCm")) : null,
      dateOfBirth: (formData.get("dateOfBirth") as string) ? new Date(formData.get("dateOfBirth") as string).toISOString() : null,
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
      fetchData();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    setError("");
    try {
      await api.delete(`/admin/players/${id}`);
      fetchData();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const togglePosition = (pos: string) => {
    setSelectedPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
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
                    defaultValue={isEditing.firstName || ""}
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1.5 mt-4">
                  <label className="text-xs font-semibold text-slate-300">Last Name</label>
                  <input
                    name="lastName"
                    defaultValue={isEditing.lastName || ""}
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Display Name</label>
                  <input
                    name="name"
                    defaultValue={isEditing.name || ""}
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Aliases (comma separated)</label>
                  <input
                    name="aliases"
                    defaultValue={isEditing.aliases?.join(", ") || ""}
                    placeholder="Leave blank to default to [firstName, lastName]"
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
                
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Nationality</label>
                  <select
                    name="nationality"
                    defaultValue={isEditing.nationality || ""}
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="" className="bg-slate-900" disabled>Select Country</option>
                    {countries.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name} ({c.id})</option>)}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Current Club</label>
                  <select
                    name="currentClubId"
                    defaultValue={isEditing.currentClubId || ""}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="" className="bg-slate-900">None / Free Agent</option>
                    {clubs.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
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
                    defaultValue={isEditing.primaryPosition || ""}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="" className="bg-slate-900">None</option>
                    {POSITIONS.map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
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

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-300 hover:text-white transition">
                    <input
                      type="checkbox"
                      name="isRetired"
                      defaultChecked={isEditing.isRetired}
                      className="rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/20 w-4 h-4"
                    />
                    Player is Retired
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
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={history.isCurrent}
                          onChange={(e) => updateClubHistory(idx, 'isCurrent', e.target.checked)}
                          className="rounded border-white/20 bg-black/40 text-blue-500 w-3.5 h-3.5"
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

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-white/[0.06] bg-white/[0.02]">
              <tr>
                <th className="px-5 py-4 font-semibold text-slate-300">Name</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Nationality</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Current Club</th>
                <th className="px-5 py-4 font-semibold text-slate-300">Status</th>
                <th className="px-5 py-4 font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {players.map((player) => (
                <tr key={player.id} className="transition hover:bg-white/[0.02]">
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
                      onClick={() => handleEdit(player)}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(player.id)}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No players found.
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
