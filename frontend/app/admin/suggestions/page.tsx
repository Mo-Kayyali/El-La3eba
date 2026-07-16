"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Check, X, ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";

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

export default function AdminSuggestionsPage() {
  const router = useRouter();
  const { user, bootstrapped } = useAuthStore();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // For modal
  const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!user || user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchSuggestions();
  }, [bootstrapped, user, router]);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/admin/suggestions");
      setSuggestions(res.data);
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
      
      // Remove from list
      setSuggestions((prev) => prev.filter((s) => s.id !== activeSuggestion.id));
      closeModal();
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
            Pending player reports for rejected correct answers.
          </p>
        </div>
      </div>

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
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                    PENDING
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

              <div className="flex shrink-0 items-center gap-3">
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
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {activeSuggestion && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0f172a] p-8 shadow-2xl">
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
          </div>
        </div>
      )}
    </div>
  );
}
