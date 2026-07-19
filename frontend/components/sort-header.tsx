import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

interface SortHeaderProps {
  label: string;
  field: string;
  currentSort: string;
  currentOrder: "asc" | "desc";
  onSort: (field: string, order: "asc" | "desc") => void;
  className?: string;
}

export function SortHeader({ label, field, currentSort, currentOrder, onSort, className = "" }: SortHeaderProps) {
  const isActive = currentSort === field;
  
  const handleClick = () => {
    if (isActive) {
      onSort(field, currentOrder === "asc" ? "desc" : "asc");
    } else {
      // Default to ascending for strings like 'name', but descending for dates like 'createdAt'. 
      // We can just default to desc if field === 'createdAt'
      onSort(field, field === 'createdAt' ? 'desc' : 'asc');
    }
  };

  return (
    <th className={`px-5 py-4 font-semibold text-slate-300 ${className}`}>
      <button 
        onClick={handleClick}
        className="flex items-center gap-1.5 hover:text-white transition group outline-none"
      >
        {label}
        <span className="flex items-center text-slate-400 group-hover:text-violet-300 transition-colors">
          {isActive ? (
            currentOrder === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-violet-400" /> : <ArrowDown className="w-3.5 h-3.5 text-violet-400" />
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
          )}
        </span>
      </button>
    </th>
  );
}
