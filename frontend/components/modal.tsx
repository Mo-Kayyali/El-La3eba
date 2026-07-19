import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = "max-w-4xl" 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4 pt-24 sm:p-6 sm:pt-28 pb-10">
        <div 
          ref={modalRef}
          className={`w-full ${maxWidth} rounded-3xl border border-white/10 bg-[#0f172a] shadow-2xl relative`}
        >
        <div className="flex items-center justify-between border-b border-white/10 px-8 py-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button 
            type="button"
            onClick={onClose} 
            className="rounded-full bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-8">
          {children}
        </div>
      </div>
      </div>
    </div>
  );
}
