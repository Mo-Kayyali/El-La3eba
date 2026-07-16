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
    <div className="p-8 max-w-4xl mx-auto text-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Admin: Competitions</h1>
        <button
          onClick={() => setIsEditing({})}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-medium"
        >
          Add Competition
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 p-4 rounded mb-6 border border-red-500/50">
          {error}
        </div>
      )}

      {isEditing && (
        <div className="bg-slate-800 p-6 rounded-lg mb-8 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 text-white">
            {isEditing.id ? "Edit" : "New"} Competition
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                name="name"
                defaultValue={isEditing.name || ""}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                name="type"
                defaultValue={isEditing.type || "DOMESTIC_LEAGUE"}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              >
                <option value="DOMESTIC_LEAGUE">Domestic League</option>
                <option value="DOMESTIC_CUP">Domestic Cup</option>
                <option value="CONTINENTAL_CLUB">Continental Club</option>
                <option value="INTERNATIONAL_NATIONAL_TEAM">International / National Team</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Country Code (ISO-3)</label>
              <input
                name="countryCode"
                defaultValue={isEditing.countryCode || ""}
                placeholder="e.g. ENG"
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tier</label>
              <input
                name="tier"
                type="number"
                defaultValue={isEditing.tier || ""}
                placeholder="e.g. 1"
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
              />
            </div>
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(null)}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Country</th>
              <th className="p-4 font-medium">Tier</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {competitions.map((comp) => (
              <tr key={comp.id} className="hover:bg-slate-700/30">
                <td className="p-4">{comp.name}</td>
                <td className="p-4 text-sm text-slate-400">{comp.type}</td>
                <td className="p-4">{comp.countryCode || "-"}</td>
                <td className="p-4">{comp.tier || "-"}</td>
                <td className="p-4 flex gap-3">
                  <button
                    onClick={() => setIsEditing(comp)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(comp.id)}
                    className="text-red-400 hover:text-red-300"
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
  );
}
