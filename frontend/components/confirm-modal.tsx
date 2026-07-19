import { Modal } from "./modal";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string | React.ReactNode;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true,
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-slate-300">
          {message}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-2xl border border-white/[0.1] bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.08] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
              isDestructive 
                ? "bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_24px_rgba(239,68,68,0.25)] hover:brightness-110" 
                : "bg-gradient-to-r from-violet-600 to-violet-500 shadow-[0_0_24px_rgba(139,92,246,0.25)] hover:brightness-110"
            }`}
          >
            {isLoading ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
