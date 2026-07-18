"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Check, X, ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Pagination } from "@/components/pagination";

type Suggestion = {
  id: string;
  guessText: string;
  comment: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  suggester: {
    username: string;
    email: string;
  };
  player: {
    id: string;
    name: string;
    aliases: string[];
    image: string | null;
  };
  question: {
    id: string;
    text: string;
    answerType: string;
  };
};

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AdminSuggestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, bootstrapped } = useAuthStore();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // For modal
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessOptions, setShowSuccessOptions] = useState(false);
  
  const initialTab = (searchParams.get("tab") as any) || "PENDING";
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">(initialTab);
  
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, page: 1 });

  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (currentTab !== statusFilter) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", statusFilter);
      router.replace(`?${params.toString()}`);
    }
  }, [statusFilter, router, searchParams]);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!user || user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchSuggestions();
  }, [bootstrapped, user, router, statusFilter, page]);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      params.append("page", page.toString());
      params.append("limit", "50");
      
      const res = await api.get<{data: Suggestion[], meta: any}>(`/admin/suggestions?${params.toString()}`);
      setSuggestions(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load suggestions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!activeSuggestion || !actionType) return;
    setIsSubmitting(true);
    try {
      const endpoint = `/admin/suggestions/${activeSuggestion.id}/${actionType}`;
      const res = await api.post(endpoint, { reviewNote: reviewNote.trim() || undefined });
      
      toast.success(res.data.message || `Suggestion ${actionType}d`);
      
      // Update status in list
      setSuggestions((prev) => 
        prev.map((s: Suggestion) => s.id === activeSuggestion.id ? { ...s, status: actionType === "approve" ? "APPROVED" : "REJECTED" } : s)
      );
      
      if (actionType === "approve") {
        setShowSuccessOptions(true);
      } else {
        closeModal();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${actionType} suggestion`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openModal = (suggestion: Suggestion, type: "approve" | "reject") => {
    setActiveSuggestion(suggestion);
    setActionType(type);
    setReviewNote("");
  };

  const closeModal = () => {
    setActiveSuggestion(null);
    setActionType(null);
    setReviewNote("");
    setShowSuccessOptions(false);
  };

  if (!bootstrapped || !user || user.role !== "ADMIN") return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/admin"
          className="rounded-full bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-white">Review Suggestions</h1>
          <p className="mt-1 text-slate-400">
            Player reports for rejected correct answers.
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${statusFilter === status ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold shrink-0">
          <div className="flex items-center gap-1.5 text-slate-400/80 bg-slate-500/10 px-3 py-1.5 rounded-full"><span className="text-slate-300">{meta.total}</span> {statusFilter === "ALL" ? "Total" : statusFilter} Suggestions</div>
        </div>
      </div>

      {suggestions.length > 0 && !isLoading && (
        <div className="mb-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl backdrop-blur-xl">
          <Pagination 
            currentPage={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.total}
            onPageChange={setPage}
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-slate-500">Loading suggestions...</div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] py-20 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-bold text-slate-300">No Pending Suggestions</h3>
          <p className="mt-2 text-sm text-slate-500">You're all caught up!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl border border-white/10 bg-slate-900/40 p-6 transition hover:border-white/20"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    suggestion.status === "PENDING" ? "bg-amber-500/10 text-amber-400" :
                    suggestion.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {suggestion.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(suggestion.createdAt).toLocaleString()}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Question: {suggestion.question.text}
                </h3>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">Guessed Text:</span>
                  <span className="font-semibold text-blue-300">"{suggestion.guessText}"</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <span className="text-slate-400">Matched Player:</span>
                  <span className="font-semibold text-emerald-300">{suggestion.player.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <span className="text-slate-400">Suggested By:</span>
                  <span className="font-medium text-slate-300">
                    {suggestion.suggester.username} ({suggestion.suggester.email})
                  </span>
                </div>
                {suggestion.comment && (
                  <div className="mt-3 rounded-lg bg-black/40 p-3 text-sm text-slate-300 border border-white/5">
                    <span className="block text-xs font-semibold text-slate-500 mb-1">Comment:</span>
                    {suggestion.comment}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-2">
                {suggestion.status === "PENDING" && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openModal(suggestion, "reject")}
                      className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                    <button
                      onClick={() => openModal(suggestion, "approve")}
                      className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </button>
                  </div>
                )}
                {suggestion.status === "APPROVED" && (
                  <div className="flex flex-col items-end gap-3 mt-2">
                    <Link
                      href={`/admin/players?edit=${suggestion.player.id}`}
                      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20 text-center w-full sm:w-auto"
                    >
                      Edit this player's data
                    </Link>
                    <Link
                      href={`/admin/questions?edit=${suggestion.question.id}`}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 text-center w-full sm:w-auto"
                    >
                      Edit this question
                    </Link>
                  </div>
                )}
                {suggestion.status === "REJECTED" && (
                  <div className="text-sm font-bold text-red-400 self-end">
                    Rejected
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-6">
          <Pagination 
            currentPage={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.total}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modal */}
      {activeSuggestion && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0f172a] p-8 shadow-2xl">
            {showSuccessOptions ? (
              <>
                <div className="mb-6 flex justify-center">
                  <div className="rounded-full bg-emerald-500/20 p-4 text-emerald-400">
                    <Check className="h-8 w-8" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 text-center">
                  Suggestion Approved!
                </h3>
                <p className="text-sm text-slate-400 mb-8 text-center">
                  Would you like to edit the player or question data now?
                </p>
                <div className="flex flex-col gap-3">
                  <Link
                    href={`/admin/players?edit=${activeSuggestion.player.id}`}
                    className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-blue-500 transition"
                  >
                    Edit Player ({activeSuggestion.player.name})
                  </Link>
                  <Link
                    href={`/admin/questions?edit=${activeSuggestion.question.id}`}
                    className="rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-violet-500 transition"
                  >
                    Edit Question
                  </Link>
                  <button
                    onClick={closeModal}
                    className="mt-2 rounded-xl px-4 py-3 text-center text-sm font-semibold text-slate-400 hover:bg-white/5 transition"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white mb-2">
                  {actionType === "approve" ? "Approve Suggestion" : "Reject Suggestion"}
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  {actionType === "approve"
                    ? "This will add the answer to the question and mark it as correct in the future."
                    : "This will dismiss the suggestion and keep the current logic."}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Admin Note (Optional)
                    </label>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Reasoning for this decision..."
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition resize-none h-24"
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3 justify-end">
                  <button
                    onClick={closeModal}
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAction}
                    disabled={isSubmitting}
                    className={`rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      actionType === "approve"
                        ? "bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-400"
                        : "bg-red-500 shadow-red-500/20 hover:bg-red-400"
                    }`}
                  >
                    {isSubmitting ? "Processing..." : actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSuggestionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading...</div>}>
      <AdminSuggestionsContent />
    </Suspense>
  );
}
