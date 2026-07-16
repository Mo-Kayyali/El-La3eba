"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { ArrowLeft, X, Search, Check, AlertCircle } from "lucide-react";
import { api, extractApiErrorMessage } from "@/lib/api";

type PlayerSearchResult = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  nationality: string;
  isRetired: boolean;
  currentClub: { name: string } | null;
};

type QuestionAnswer = {
  playerId: string;
  rank?: number;
  slotLabel?: string;
  player?: { name: string; aliases: string[] };
};

type QuestionFilterClause = {
  filterType: string;
  filterValue: string;
};

type Question = {
  id: string;
  text: string;
  gameMode: "STRIKES" | "TOP_10" | "LINEUP" | "PHOTO_GUESS";
  answerType: "FILTER" | "LIST";
  logicOperator: "AND" | "OR" | null;
  clauses?: QuestionFilterClause[];
  photoPlayerId: string | null;
  photoPlayer?: { name: string } | null;
  _count?: { answers: number };
  answers?: QuestionAnswer[];
};

function PlayerSearch({ 
  onSelect, 
  placeholder = "Search player by name...",
  autoClear = true
}: { 
  onSelect: (p: PlayerSearchResult) => void;
  placeholder?: string;
  autoClear?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setIsLoading(true);
        try {
          const res = await api.get<PlayerSearchResult[]>(`/admin/players/search?q=${encodeURIComponent(query)}`);
          setResults(res.data);
          setShowDropdown(true);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-slate-500" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
          className="block w-full rounded-xl border border-white/10 bg-slate-900/50 p-3 pl-10 text-white placeholder-slate-500 outline-none transition focus:border-violet-500 focus:bg-slate-800 focus:ring-1 focus:ring-violet-500"
          placeholder={placeholder}
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-white/10 bg-slate-800 shadow-xl">
          <ul className="py-1">
            {results.map((p) => (
              <li
                key={p.id}
                onClick={() => {
                  onSelect(p);
                  if (autoClear) {
                    setQuery("");
                    setResults([]);
                  } else {
                    setQuery(p.name);
                  }
                  setShowDropdown(false);
                }}
                className="flex cursor-pointer items-center justify-between px-4 py-2 hover:bg-slate-700 text-white"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-400">
                    {p.nationality} • {p.currentClub?.name || (p.isRetired ? "Retired" : "Free Agent")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AdminQuestionsPage() {
  const { user, bootstrapped } = useAuthStore();
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [gameMode, setGameMode] = useState<"STRIKES" | "TOP_10" | "LINEUP" | "PHOTO_GUESS">("STRIKES");
  const [answerType, setAnswerType] = useState<"FILTER" | "LIST">("FILTER");
  const [logicOperator, setLogicOperator] = useState<"AND" | "OR">("AND");
  const [clauses, setClauses] = useState<QuestionFilterClause[]>([{ filterType: "NATIONALITY", filterValue: "" }]);
  const [photoPlayerId, setPhotoPlayerId] = useState("");
  const [photoPlayerName, setPhotoPlayerName] = useState("");
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!user || user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchQuestions();
  }, [bootstrapped, user, router]);

  useEffect(() => {
    // Auto-set answer type rules based on game mode
    if (gameMode === "TOP_10" || gameMode === "LINEUP" || gameMode === "PHOTO_GUESS") {
      setAnswerType("LIST");
    }
  }, [gameMode]);

  const fetchQuestions = async () => {
    try {
      const [res, clubsRes, compsRes, countriesRes] = await Promise.all([
        api.get<Question[]>("/admin/questions"),
        api.get<any[]>("/admin/clubs"),
        api.get<any[]>("/admin/competitions"),
        api.get<any[]>("/admin/countries"),
      ]);
      setQuestions(res.data);
      setClubs(clubsRes.data);
      setCompetitions(compsRes.data);
      setCountries(countriesRes.data);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (q: Question) => {
    setEditingId(q.id);
    setText(q.text);
    setGameMode(q.gameMode);
    setAnswerType(q.answerType);
    setLogicOperator(q.logicOperator || "AND");
    
    try {
      // Fetch full question with answers
      const res = await api.get<Question>(`/admin/questions/${q.id}`);
      const fullQ = res.data;
      setAnswers(fullQ.answers || []);
      if (fullQ.answerType === "FILTER" && fullQ.clauses && fullQ.clauses.length > 0) {
        setClauses(fullQ.clauses);
      } else {
        setClauses([{ filterType: "NATIONALITY", filterValue: "" }]);
      }
      setPhotoPlayerId(fullQ.photoPlayerId || "");
      setPhotoPlayerName(fullQ.photoPlayer?.name || "");
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      alert("Failed to load question details");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      await api.delete(`/admin/questions/${id}`);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      alert(extractApiErrorMessage(err));
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setText("");
    setGameMode("STRIKES");
    setAnswerType("FILTER");
    setLogicOperator("AND");
    setClauses([{ filterType: "NATIONALITY", filterValue: "" }]);
    setPhotoPlayerId("");
    setPhotoPlayerName("");
    setAnswers([]);
    setShowForm(false);
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    const payload: any = {
      text,
      gameMode,
    };

    if (gameMode === "PHOTO_GUESS") {
      if (!photoPlayerId) {
        setFormError("A player is required for PHOTO_GUESS");
        setIsSubmitting(false);
        return;
      }
      payload.photoPlayerId = photoPlayerId;
    } else {
      payload.answerType = answerType;

      if (answerType === "FILTER") {
        const cleanClauses = clauses.filter(c => c.filterValue.trim() !== "");
        if (cleanClauses.length === 0) {
          setFormError("At least one valid clause is required");
          setIsSubmitting(false);
          return;
        }
        payload.clauses = cleanClauses;
        if (cleanClauses.length > 1) {
          payload.logicOperator = logicOperator;
        }
      } else {
        if (answers.length === 0) {
          setFormError("At least one answer is required for LIST");
          setIsSubmitting(false);
          return;
        }
        
        // Basic frontend dup check
        const pIds = new Set();
        const ranks = new Set();
        const slots = new Set();
        for (const a of answers) {
          if (pIds.has(a.playerId)) {
            setFormError("Duplicate player in answers list");
            setIsSubmitting(false);
            return;
          }
          pIds.add(a.playerId);
          
          if (gameMode === "TOP_10") {
            if (!a.rank) {
              setFormError("All TOP_10 answers need a rank");
              setIsSubmitting(false); return;
            }
            if (ranks.has(a.rank)) {
              setFormError("Duplicate rank found");
              setIsSubmitting(false); return;
            }
            ranks.add(a.rank);
          }
          if (gameMode === "LINEUP") {
            if (!a.slotLabel) {
              setFormError("All LINEUP answers need a slot label");
              setIsSubmitting(false); return;
            }
            if (slots.has(a.slotLabel)) {
              setFormError("Duplicate slot label found");
              setIsSubmitting(false); return;
            }
            slots.add(a.slotLabel);
          }
        }
        payload.answers = answers.map(a => ({
          playerId: a.playerId,
          rank: a.rank ? Number(a.rank) : undefined,
          slotLabel: a.slotLabel?.trim() || undefined
        }));
      }
    }

    try {
      if (editingId) {
        await api.patch(`/admin/questions/${editingId}`, payload);
      } else {
        await api.post("/admin/questions", payload);
      }
      resetForm();
      fetchQuestions();
    } catch (err) {
      setFormError(extractApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const addAnswer = (p: PlayerSearchResult) => {
    if (answers.some(a => a.playerId === p.id)) {
      alert("Player already in list");
      return;
    }
    setAnswers(prev => [...prev, {
      playerId: p.id,
      player: { name: p.name, aliases: [] }
    }]);
  };

  const removeAnswer = (idx: number) => {
    setAnswers(prev => prev.filter((_, i) => i !== idx));
  };

  const updateAnswer = (idx: number, field: string, val: string | number) => {
    setAnswers(prev => {
      const copy = [...prev];
      (copy[idx] as any)[field] = val;
      return copy;
    });
  };

  if (!bootstrapped || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-3xl font-bold">Questions</h1>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-xl bg-violet-600 px-6 py-2.5 font-medium text-white transition hover:bg-violet-700"
            >
              Add Question
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Form Panel */}
        {showForm && (
          <div className="mb-10 rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-md sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingId ? "Edit Question" : "Create New Question"}
              </h2>
              <button
                onClick={resetForm}
                className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Question Text
                </label>
                <input
                  type="text"
                  required
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  placeholder="e.g., Name a player who played for Real Madrid"
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Game Mode
                  </label>
                  <select
                    value={gameMode}
                    onChange={(e) => setGameMode(e.target.value as any)}
                    className="block w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="STRIKES">STRIKES</option>
                    <option value="TOP_10">TOP_10</option>
                    <option value="LINEUP">LINEUP</option>
                    <option value="PHOTO_GUESS">PHOTO_GUESS</option>
                  </select>
                </div>

                {gameMode === "STRIKES" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Answer Type
                    </label>
                    <select
                      value={answerType}
                      onChange={(e) => setAnswerType(e.target.value as any)}
                      className="block w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="FILTER">FILTER (DB checks logic)</option>
                      <option value="LIST">LIST (Specific exact players)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* STRIKES + FILTER */}
              {gameMode === "STRIKES" && answerType === "FILTER" && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-300">Filter Clauses</label>
                    <button
                      type="button"
                      onClick={() => setClauses([...clauses, { filterType: "NATIONALITY", filterValue: "" }])}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300"
                    >
                      + Add Clause
                    </button>
                  </div>
                  
                  {clauses.length > 1 && (
                    <div className="flex items-center gap-4 mb-4 bg-slate-900/50 p-3 rounded-lg border border-white/5">
                      <span className="text-sm font-medium text-slate-400">Match rule for multiple clauses:</span>
                      <select
                        value={logicOperator}
                        onChange={(e) => setLogicOperator(e.target.value as any)}
                        className="rounded-lg bg-slate-800 border border-white/10 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                      >
                        <option value="AND">AND (Must match all)</option>
                        <option value="OR">OR (Match any one)</option>
                      </select>
                    </div>
                  )}

                  {clauses.map((clause, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start bg-slate-900/50 p-3 rounded-xl border border-white/5">
                      <div className="flex-1 w-full sm:max-w-[200px]">
                        <select
                          value={clause.filterType}
                          onChange={(e) => {
                            const newClauses = [...clauses];
                            newClauses[idx].filterType = e.target.value;
                            newClauses[idx].filterValue = "";
                            setClauses(newClauses);
                          }}
                          className="w-full block rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white outline-none focus:border-blue-500"
                        >
                          <option value="NATIONALITY">Nationality</option>
                          <option value="CLUB">Club</option>
                          <option value="COMPETITION">Competition</option>
                          <option value="POSITION">Position (Specific)</option>
                          <option value="POSITION_CATEGORY">Position Category</option>
                        </select>
                      </div>
                      
                      <div className="flex-[2] w-full flex items-center gap-2">
                        {clause.filterType === "NATIONALITY" && (
                          <select
                            value={clause.filterValue}
                            onChange={(e) => {
                              const newClauses = [...clauses];
                              newClauses[idx].filterValue = e.target.value;
                              setClauses(newClauses);
                            }}
                            className="w-full block rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white outline-none focus:border-blue-500"
                          >
                            <option value="">Select Country...</option>
                            {countries.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                          </select>
                        )}
                        {clause.filterType === "CLUB" && (
                          <select
                            value={clause.filterValue}
                            onChange={(e) => {
                              const newClauses = [...clauses];
                              newClauses[idx].filterValue = e.target.value;
                              setClauses(newClauses);
                            }}
                            className="w-full block rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white outline-none focus:border-blue-500"
                          >
                            <option value="">Select Club...</option>
                            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                        {clause.filterType === "COMPETITION" && (
                          <select
                            value={clause.filterValue}
                            onChange={(e) => {
                              const newClauses = [...clauses];
                              newClauses[idx].filterValue = e.target.value;
                              setClauses(newClauses);
                            }}
                            className="w-full block rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white outline-none focus:border-blue-500"
                          >
                            <option value="">Select Competition...</option>
                            {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                        {clause.filterType === "POSITION" && (
                          <select
                            value={clause.filterValue}
                            onChange={(e) => {
                              const newClauses = [...clauses];
                              newClauses[idx].filterValue = e.target.value;
                              setClauses(newClauses);
                            }}
                            className="w-full block rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white outline-none focus:border-blue-500"
                          >
                            <option value="">Select Position...</option>
                            {["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "CF", "ST"].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        )}
                        {clause.filterType === "POSITION_CATEGORY" && (
                          <select
                            value={clause.filterValue}
                            onChange={(e) => {
                              const newClauses = [...clauses];
                              newClauses[idx].filterValue = e.target.value;
                              setClauses(newClauses);
                            }}
                            className="w-full block rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white outline-none focus:border-blue-500"
                          >
                            <option value="">Select Category...</option>
                            {["GOALKEEPER", "DEFENDER", "MIDFIELDER", "ATTACKER"].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const newClauses = [...clauses];
                            newClauses.splice(idx, 1);
                            setClauses(newClauses);
                          }}
                          className="text-slate-400 hover:text-red-400 transition shrink-0 ml-2"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PHOTO GUESS */}
              {gameMode === "PHOTO_GUESS" && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Player in Photo
                  </label>
                  {photoPlayerId ? (
                    <div className="flex items-center justify-between rounded-xl bg-slate-800 p-3 border border-white/10">
                      <span className="font-medium">{photoPlayerName}</span>
                      <button
                        type="button"
                        onClick={() => { setPhotoPlayerId(""); setPhotoPlayerName(""); }}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <PlayerSearch 
                      placeholder="Search to select photo player..."
                      autoClear={false}
                      onSelect={(p) => {
                        setPhotoPlayerId(p.id);
                        setPhotoPlayerName(p.name);
                      }} 
                    />
                  )}
                </div>
              )}

              {/* LIST based answers (STRIKES-LIST, TOP_10, LINEUP) */}
              {gameMode !== "PHOTO_GUESS" && (gameMode !== "STRIKES" || answerType === "LIST") && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4">
                  <label className="block text-sm font-medium text-slate-300">
                    Answers List
                  </label>
                  
                  <PlayerSearch onSelect={addAnswer} />

                  {answers.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-slate-900/50">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-800/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Player</th>
                            {gameMode === "TOP_10" && <th className="px-4 py-3 w-32">Rank (1-10)</th>}
                            {gameMode === "LINEUP" && <th className="px-4 py-3 w-40">Slot (e.g. GK)</th>}
                            <th className="px-4 py-3 w-16 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {answers.map((ans, idx) => (
                            <tr key={ans.playerId + idx} className="hover:bg-slate-800/50">
                              <td className="px-4 py-3 font-medium text-white">
                                {ans.player?.name || "Unknown"}
                              </td>
                              {gameMode === "TOP_10" && (
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={ans.rank || ""}
                                    onChange={(e) => updateAnswer(idx, "rank", parseInt(e.target.value) || "")}
                                    className="w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white focus:border-emerald-500 outline-none"
                                  />
                                </td>
                              )}
                              {gameMode === "LINEUP" && (
                                <td className="px-4 py-3">
                                  <input
                                    type="text"
                                    value={ans.slotLabel || ""}
                                    onChange={(e) => updateAnswer(idx, "slotLabel", e.target.value)}
                                    placeholder="e.g. GK, ST"
                                    className="w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white focus:border-emerald-500 outline-none"
                                  />
                                </td>
                              )}
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeAnswer(idx)}
                                  className="text-slate-400 hover:text-red-400 transition"
                                >
                                  <X className="h-5 w-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-4 border-t border-white/10 pt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl px-6 py-2.5 font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Check className="h-5 w-5" />
                  )}
                  {editingId ? "Save Changes" : "Create Question"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List Panel */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md">
          {questions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No questions found. Add one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Question Text</th>
                    <th className="px-6 py-4">Mode / Type</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {questions.map((q) => (
                    <tr
                      key={q.id}
                      className="transition hover:bg-slate-800/50"
                    >
                      <td className="px-6 py-4 font-medium text-white">
                        {q.text}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex w-fit rounded-full bg-violet-500/20 px-2 py-1 text-xs font-medium text-violet-300">
                            {q.gameMode}
                          </span>
                          {q.gameMode === "STRIKES" && (
                            <span className="text-xs text-slate-400">
                              {q.answerType}
                              {q.answerType === "FILTER" ? ` (${q.clauses?.length || 0} clauses)` : ` (${q._count?.answers} answers)`}
                            </span>
                          )}
                          {(q.gameMode === "TOP_10" || q.gameMode === "LINEUP") && (
                            <span className="text-xs text-slate-400">
                              {q._count?.answers} items
                            </span>
                          )}
                          {q.gameMode === "PHOTO_GUESS" && (
                            <span className="text-xs text-slate-400">
                              Target ID: {q.photoPlayerId?.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEdit(q)}
                          className="mr-3 font-medium text-violet-400 hover:text-violet-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="font-medium text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
