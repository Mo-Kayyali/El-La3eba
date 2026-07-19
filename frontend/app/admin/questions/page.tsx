"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Plus, Search, Trash2, X, Check } from "lucide-react";
import { api, extractApiErrorMessage } from "@/lib/api";
import { FilterSelect } from "@/components/filter-select";
import { ConfirmModal } from "@/components/confirm-modal";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { Modal } from "@/components/modal";
import { PlayerFormModal, Player } from "@/components/admin/player-form-modal";

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
  timeframe?: "CURRENT" | "PAST" | "BOTH";
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
  isActive?: boolean;
  playerStatusFilter?: "ANY" | "CURRENT_ONLY" | "RETIRED_ONLY";
  scope?: "NATIONAL" | "INTERNATIONAL" | "BOTH";
  createdAt: string;
};

function PlayerSearch({ 
  onSelect, 
  onEdit,
  placeholder = "Search player by name...",
  autoClear = true
}: { 
  onSelect: (p: PlayerSearchResult) => void;
  onEdit?: (playerId: string) => void;
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
                className="flex items-center justify-between px-4 py-2 hover:bg-slate-700 text-white"
              >
                <div 
                  className="flex-1 cursor-pointer"
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
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-400">
                    {p.nationality} • {p.currentClub?.name || (p.isRetired ? "Retired" : "Free Agent")}
                  </div>
                </div>
                {onEdit && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(p.id); setShowDropdown(false); }}
                    className="ml-2 rounded-lg border border-slate-600/50 bg-slate-700/30 p-1.5 text-slate-400 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400 transition"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import { Suspense } from "react";

function AdminQuestionsContent() {
  const { user, bootstrapped } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id?: string, bulk?: boolean, count?: number } | null>(null);

  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, page: 1 });
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [gameMode, setGameMode] = useState<"STRIKES" | "TOP_10" | "LINEUP" | "PHOTO_GUESS">("STRIKES");
  const [scope, setScope] = useState<"NATIONAL" | "INTERNATIONAL" | "BOTH">("BOTH");
  const [answerType, setAnswerType] = useState<"FILTER" | "LIST">("FILTER");
  const [logicOperator, setLogicOperator] = useState<"AND" | "OR">("AND");
  const [clauses, setClauses] = useState<QuestionFilterClause[]>([{ filterType: "NATIONALITY", filterValue: "" }]);
  const [photoPlayerId, setPhotoPlayerId] = useState("");
  const [photoPlayerName, setPhotoPlayerName] = useState("");
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [playerStatusFilter, setPlayerStatusFilter] = useState<"ANY" | "CURRENT_ONLY" | "RETIRED_ONLY">("ANY");

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // List filters
  const [filterGameMode, setFilterGameMode] = useState<string>("");
  const [filterIsActive, setFilterIsActive] = useState<string>("");

  // Test guess state
  const [testGuessName, setTestGuessName] = useState("");
  const [testGuessResult, setTestGuessResult] = useState<any>(null);
  const [isTestingGuess, setIsTestingGuess] = useState(false);

  // New states for Part 2
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [playerModalContext, setPlayerModalContext] = useState<{ mode: 'edit', player: Partial<Player> } | { mode: 'create' } | null>(null);

  const openPlayerEditModal = async (playerId: string) => {
    try {
      const { data } = await api.get<Player>(`/admin/players/${playerId}`);
      setPlayerModalContext({ mode: 'edit', player: data });
    } catch (err) {
      alert("Failed to load player details");
    }
  };

  useEffect(() => {
    if (!bootstrapped) return;
    if (!user || user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchData();
  }, [bootstrapped, user, router]);

  useEffect(() => {
    // Auto-set answer type rules based on game mode
    if (gameMode === "TOP_10" || gameMode === "LINEUP" || gameMode === "PHOTO_GUESS") {
      setAnswerType("LIST");
    }
  }, [gameMode]);

  const fetchData = async () => {
    try {
      const [clubsRes, compsRes, countriesRes] = await Promise.all([
        api.get<{data: any[]}>("/admin/clubs", { params: { limit: 10000 } }),
        api.get<{data: any[]}>("/admin/competitions", { params: { limit: 1000 } }),
        api.get<any[]>("/admin/countries"),
      ]);
      setClubs(clubsRes.data.data);
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
    fetchQuestions();
  }, [bootstrapped, user, page, search, filterGameMode, filterIsActive, sort, order]);

  useEffect(() => {
    const delay = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(delay);
  }, [searchInput]);

  const fetchQuestions = async () => {
    try {
      const params = new URLSearchParams();
      if (filterGameMode) params.append("gameMode", filterGameMode);
      if (filterIsActive) params.append("isActive", filterIsActive);
      if (search) params.append("search", search);
      if (sort) params.append("sort", sort);
      if (order) params.append("order", order);
      params.append("page", page.toString());
      params.append("limit", "50");

      const res = await api.get<{data: Question[], meta: any}>(`/admin/questions?${params.toString()}`);
      setQuestions(res.data.data);
      setMeta(res.data.meta);
      setSelectedQuestionIds([]);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  useEffect(() => {
    if (editId && questions.length > 0 && !showForm) {
      const q = questions.find(q => q.id === editId);
      if (q) {
        handleEdit(q);
      } else {
        // Fetch directly if not in list
        api.get<Question>(`/admin/questions/${editId}`).then(res => {
          handleEdit(res.data);
        }).catch(err => console.error(err));
      }
    }
  }, [editId, questions, showForm]);

  const handleEdit = async (q: Question) => {
    setEditingId(q.id);
    setText(q.text);
    setGameMode(q.gameMode);
    setScope(q.scope || "BOTH");
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
      setIsActive(fullQ.isActive ?? true);
      setPlayerStatusFilter(fullQ.playerStatusFilter || "ANY");
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      alert("Failed to load question details");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/questions/${id}`);
      if (editingId === id) resetForm();
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setConfirmDelete(null);
    } catch (err) {
      alert(extractApiErrorMessage(err));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.length === 0) return;
    setError("");
    try {
      await Promise.all(selectedQuestionIds.map(id => api.delete(`/admin/questions/${id}`)));
      setShowForm(false);
      setEditingId(null);
      if (editId) router.replace('/admin/questions');
      fetchQuestions();
      setConfirmDelete(null);
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const toggleQuestionSelection = (id: string) => {
    setSelectedQuestionIds(prev => 
      prev.includes(id) ? prev.filter(qid => qid !== id) : [...prev, id]
    );
  };

  const resetForm = () => {
    setEditingId(null);
    setText("");
    setGameMode("STRIKES");
    setScope("BOTH");
    setAnswerType("FILTER");
    setLogicOperator("AND");
    setClauses([{ filterType: "NATIONALITY", filterValue: "" }]);
    setPhotoPlayerId("");
    setPhotoPlayerName("");
    setAnswers([]);
    setIsActive(true);
    setPlayerStatusFilter("ANY");
    setTestGuessName("");
    setTestGuessResult(null);
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
      scope,
      isActive,
      playerStatusFilter,
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
        payload.clauses = cleanClauses.map(c => ({
          filterType: c.filterType,
          filterValue: c.filterValue,
          timeframe: c.timeframe || "BOTH"
        }));
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
      setDuplicateError("Already in list");
      setTimeout(() => setDuplicateError(null), 2000);
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

  const handleTestGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setIsTestingGuess(true);
    setTestGuessResult(null);
    try {
      const res = await api.post(`/admin/questions/${editingId}/test-guess`, { guessName: testGuessName });
      setTestGuessResult(res.data);
    } catch (e) {
      alert("Test guess failed: " + extractApiErrorMessage(e));
    } finally {
      setIsTestingGuess(false);
    }
  };

  if (!bootstrapped || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 text-slate-200">
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Deletion"
        message={confirmDelete?.bulk ? `Are you sure you want to delete ${confirmDelete.count} selected questions? This action cannot be undone.` : "Are you sure you want to delete this question? This action cannot be undone."}
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
      <div>
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchQuestions()}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-medium text-white hover:bg-white/10 transition"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-xl bg-violet-600 px-6 py-2.5 font-medium text-white transition hover:bg-violet-700"
            >
              Add Question
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Form Panel */}
        <Modal 
          isOpen={showForm} 
          onClose={() => {
            setShowForm(false);
            if (editId) router.replace('/admin/questions');
          }} 
          title={editingId ? "Edit Question" : "Create New Question"}
        >

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

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Question Scope
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as any)}
                    className="block w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="BOTH">Both (National & International)</option>
                    <option value="NATIONAL">National (Egypt Only)</option>
                    <option value="INTERNATIONAL">International Only</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">

                {gameMode === "STRIKES" ? (
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
                ) : <div />}
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Player Status Filter
                  </label>
                  <select
                    value={playerStatusFilter}
                    onChange={(e) => setPlayerStatusFilter(e.target.value as any)}
                    className="block w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="ANY">Any (Active & Retired)</option>
                    <option value="CURRENT_ONLY">Active Only</option>
                    <option value="RETIRED_ONLY">Retired Only</option>
                  </select>
                </div>

              </div>

              <div className="flex items-center pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-5 w-5 rounded border-white/10 bg-slate-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm font-medium text-slate-300">Question is Active</span>
                </label>
              </div>

              {/* STRIKES + FILTER */}
              {gameMode === "STRIKES" && answerType === "FILTER" && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-300">Filter Clauses</label>
                    <button
                      type="button"
                      onClick={() => setClauses([...clauses, { filterType: "NATIONALITY", filterValue: "" }])}
                      className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20"
                    >
                      <Plus className="h-3 w-3" />
                      Add Clause
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
                          <div className="flex w-full items-center gap-2">
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
                              {clubs.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            <select
                              value={clause.timeframe || "BOTH"}
                              onChange={(e) => {
                                const newClauses = [...clauses];
                                newClauses[idx].timeframe = e.target.value as "CURRENT" | "PAST" | "BOTH";
                                setClauses(newClauses);
                              }}
                              className="shrink-0 w-32 block rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white outline-none focus:border-blue-500"
                            >
                              <option value="BOTH">Both</option>
                              <option value="CURRENT">Current Only</option>
                              <option value="PAST">Past Only</option>
                            </select>
                          </div>
                        )}
                        {clause.filterType === "COMPETITION" && (
                          <div className="flex w-full items-center gap-2">
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
                              {competitions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            <select
                              value={clause.timeframe || "BOTH"}
                              onChange={(e) => {
                                const newClauses = [...clauses];
                                newClauses[idx].timeframe = e.target.value as "CURRENT" | "PAST" | "BOTH";
                                setClauses(newClauses);
                              }}
                              className="shrink-0 w-32 block rounded-xl border border-white/10 bg-slate-800 p-2.5 text-sm text-white outline-none focus:border-blue-500"
                            >
                              <option value="BOTH">Both</option>
                              <option value="CURRENT">Current Only</option>
                              <option value="PAST">Past Only</option>
                            </select>
                          </div>
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
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-300">
                      Answers List
                    </label>
                    <button
                      type="button"
                      onClick={() => setPlayerModalContext({ mode: 'create' })}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20 transition flex items-center gap-1"
                    >
                      + Add New Player
                    </button>
                  </div>
                  
                  <div className="relative">
                    <PlayerSearch onSelect={addAnswer} onEdit={openPlayerEditModal} />
                    {duplicateError && (
                      <div className="absolute right-0 top-0 -mt-8 text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">
                        {duplicateError}
                      </div>
                    )}
                  </div>

                  {answers.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-slate-900/50">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-800/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Player</th>
                            {gameMode === "TOP_10" && <th className="px-4 py-3 w-32">Rank (1-13)</th>}
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
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="1"
                                      max="13"
                                      value={ans.rank || ""}
                                      onChange={(e) => updateAnswer(idx, "rank", parseInt(e.target.value) || "")}
                                      className="w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-white focus:border-emerald-500 outline-none"
                                    />
                                    {ans.rank && ans.rank > 10 ? (
                                      <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 font-bold uppercase tracking-wider">Trap</span>
                                    ) : null}
                                  </div>
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
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); openPlayerEditModal(ans.playerId); }}
                                  className="text-slate-400 hover:text-blue-400 transition mr-3"
                                >
                                  <svg className="h-5 w-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeAnswer(idx)}
                                  className="text-slate-400 hover:text-red-400 transition"
                                >
                                  <X className="h-5 w-5 inline" />
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

            {/* Test Guess Panel */}
            {editingId && (
              <div className="mt-8 border-t border-white/10 pt-8">
                <h3 className="text-xl font-semibold mb-4">Test this Question</h3>
                <form onSubmit={handleTestGuess} className="flex gap-4 items-center">
                  <input
                    type="text"
                    value={testGuessName}
                    onChange={(e) => setTestGuessName(e.target.value)}
                    placeholder="Enter a player's name to test..."
                    className="flex-1 block rounded-xl border border-white/10 bg-slate-800 p-3 text-white outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />
                  <button
                    type="submit"
                    disabled={isTestingGuess || !testGuessName.trim()}
                    className="rounded-xl bg-slate-700 px-6 py-3 font-medium text-white transition hover:bg-slate-600 disabled:opacity-50"
                  >
                    {isTestingGuess ? "Testing..." : "Test Guess"}
                  </button>
                </form>

                {testGuessResult && (
                  <div className={`mt-6 p-4 rounded-xl border ${testGuessResult.isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`text-xl font-bold ${testGuessResult.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                        {testGuessResult.isCorrect ? "✅ Correct!" : "❌ Incorrect"}
                      </div>
                      <div className="text-sm text-slate-300">
                        {testGuessResult.matchedPlayer ? (
                          <span>Matched Player: <span className="font-semibold text-white">{testGuessResult.matchedPlayer.name}</span> ({testGuessResult.matchedPlayer.nationality})</span>
                        ) : (
                          <span>No player matched that name.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Modal>

        {/* List Panel */}
        <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative min-w-[16rem]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                }}
                placeholder="Search questions..."
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
                value={filterGameMode}
                onChange={(val) => { setFilterGameMode(val); setPage(1); }}
                options={[
                  { value: "STRIKES", label: "STRIKES" },
                  { value: "TOP_10", label: "TOP_10" },
                  { value: "LINEUP", label: "LINEUP" },
                  { value: "PHOTO_GUESS", label: "PHOTO_GUESS" }
                ]}
                placeholder="All Modes"
              />
            </div>
            <div className="w-48">
              <FilterSelect
                value={filterIsActive}
                onChange={(val) => { setFilterIsActive(val); setPage(1); }}
                options={[
                  { value: "true", label: "Active Only" },
                  { value: "false", label: "Inactive Only" }
                ]}
                placeholder="All Statuses"
              />
            </div>
          </div>
          <div className="text-sm text-slate-400">
            {meta.total} question{meta.total === 1 ? '' : 's'} found
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 pl-2">
              <span className="font-bold text-white">{selectedQuestionIds.length}</span> selected
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {selectedQuestionIds.length > 0 && (
              <button
                onClick={() => setSelectedQuestionIds([])}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                Cancel
              </button>
            )}
            {selectedQuestionIds.length > 0 && (
              <button
                onClick={() => setConfirmDelete({ bulk: true, count: selectedQuestionIds.length })}
                className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedQuestionIds.length})
              </button>
            )}
          </div>
        </div>

        {questions.length > 0 && (
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
          {questions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No questions found. Add one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-4 w-12"></th>
                    <SortHeader label="Question Text" field="text" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} className="px-6" />
                    <SortHeader label="Mode / Type" field="gameMode" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} className="px-6" />
                    <SortHeader label="Date Entered" field="createdAt" currentSort={sort} currentOrder={order} onSort={(f, o) => { setSort(f); setOrder(o); setPage(1); }} className="px-6" />
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {questions.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => toggleQuestionSelection(q.id)}
                      className={`transition cursor-pointer ${selectedQuestionIds.includes(q.id) ? 'bg-violet-500/10' : 'hover:bg-slate-800/50'}`}
                    >
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="checkbox"
                          checked={selectedQuestionIds.includes(q.id)}
                          readOnly
                          className="rounded border-white/20 bg-black/40 text-violet-500 w-4 h-4 focus:ring-violet-500/50 focus:ring-offset-0 transition pointer-events-none"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-white">
                        {q.text}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex w-fit rounded-full bg-violet-500/20 px-2 py-1 text-xs font-medium text-violet-300">
                              {q.gameMode}
                            </span>
                            {!q.isActive && (
                              <span className="inline-flex w-fit rounded-full bg-slate-500/20 px-2 py-1 text-xs font-medium text-slate-300">
                                Inactive
                              </span>
                            )}
                          </div>
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
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(q); }}
                          className="mr-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: q.id }); }}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
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
        
        <Pagination 
          currentPage={meta.page}
          totalPages={meta.totalPages}
          totalItems={meta.total}
          onPageChange={setPage}
        />
      </div>

      <PlayerFormModal
        isOpen={!!playerModalContext}
        initialData={playerModalContext?.mode === 'edit' ? playerModalContext.player : {}}
        onClose={() => setPlayerModalContext(null)}
        onSuccess={async (savedPlayer: any) => {
          setPlayerModalContext(null);
          if (playerModalContext?.mode === 'create' && savedPlayer?.id) {
            try {
              const { data } = await api.get<Player>(`/admin/players/${savedPlayer.id}`);
              addAnswer({
                id: data.id,
                name: data.name,
                firstName: data.firstName || "",
                lastName: data.lastName || "",
                nationality: data.nationality || "",
                isRetired: data.isRetired,
                currentClub: data.currentClub ? { name: data.currentClub.name } : null
              });
            } catch (e) {
              console.error("Failed to auto-add newly created player", e);
            }
          } else if (playerModalContext?.mode === 'edit' && savedPlayer?.id) {
            try {
              const { data } = await api.get<Player>(`/admin/players/${savedPlayer.id}`);
              setAnswers(prev => prev.map(a => 
                a.playerId === data.id 
                  ? { ...a, player: { name: data.name, aliases: a.player?.aliases || [] } }
                  : a
              ));
            } catch (e) {
              console.error("Failed to refresh edited player", e);
            }
          }
        }}
      />
    </div>
  );
}

export default function AdminQuestionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading...</div>}>
      <AdminQuestionsContent />
    </Suspense>
  );
}
