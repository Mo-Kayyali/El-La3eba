import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, totalItems, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-4 sm:px-6">
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-slate-400">
            Showing <span className="font-medium text-white">{totalItems > 0 ? (currentPage - 1) * 50 + 1 : 0}</span> to <span className="font-medium text-white">{Math.min(currentPage * 50, totalItems)}</span> of <span className="font-medium text-white">{totalItems}</span> results
          </p>
          {totalPages > 1 && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const p = parseInt(new FormData(e.currentTarget).get('page') as string);
                if (!isNaN(p) && p >= 1 && p <= totalPages) {
                  onPageChange(p);
                }
              }} 
              className="flex items-center gap-2"
            >
              <span className="text-sm text-slate-400">Jump to:</span>
              <input 
                name="page"
                type="number" 
                min={1} 
                max={totalPages} 
                defaultValue={currentPage}
                key={currentPage} // Reset when currentPage changes externally
                className="w-16 rounded border border-white/[0.08] bg-black/40 px-2 py-1 text-sm text-white focus:border-blue-500/50 focus:outline-none"
              />
            </form>
          )}
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.05] focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <span className="sr-only">First</span>
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 text-slate-400 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.05] focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/[0.08] bg-white/[0.02]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 text-slate-400 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.05] focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.05] focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <span className="sr-only">Last</span>
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
