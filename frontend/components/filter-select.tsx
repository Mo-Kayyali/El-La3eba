import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, X, Search } from "lucide-react";
import { matchSorter } from "match-sorter";

export type FilterOption = {
  value: string;
  label: string;
  group?: string;
};

interface FilterSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: FilterOption[];
  placeholder: string;
  className?: string;
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  className = ""
}: FilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setFocusedIndex(0);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [searchTerm]);

  const selectedOpt = options.find((o) => o.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return matchSorter(options, searchTerm, {
      keys: ['label', 'group']
    });
  }, [options, searchTerm]);

  const selectableItems = useMemo(() => {
    const items: Array<FilterOption & { isPlaceholder?: boolean }> = [];
    if (!searchTerm) {
      items.push({ value: "", label: placeholder, isPlaceholder: true });
    }
    items.push(...filteredOptions);
    return items;
  }, [filteredOptions, searchTerm, placeholder]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, selectableItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = selectableItems[focusedIndex];
      if (item) {
        onChange(item.value);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Group options if any option has a group
  const groupedOptions = filteredOptions.reduce((acc, opt) => {
    const key = opt.group || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(opt);
    return acc;
  }, {} as Record<string, FilterOption[]>);
  
  const hasGroups = filteredOptions.some(o => o.group);

  return (
    <div className={`relative flex items-center gap-2 ${className}`} ref={wrapperRef}>
      <div 
        className="relative flex-1 min-w-0 cursor-pointer rounded-xl border border-white/[0.08] bg-black/40 hover:bg-black/60 transition-colors"
      >
        <div 
          className="flex items-center justify-between px-4 py-2.5 outline-none"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={`truncate text-sm ${value ? "text-white" : "text-slate-400"}`}>
            {selectedOpt ? selectedOpt.label : placeholder}
          </span>
          <ChevronDown className={`ml-2 h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
        
        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#0f172a] shadow-2xl py-2">
            <div className="sticky top-0 z-10 px-3 pb-2 pt-1 bg-[#0f172a] border-b border-white/5 mb-2 flex items-center">
              <Search className="absolute left-6 h-4 w-4 text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-emerald-500/50"
              />
            </div>
            
            {!searchTerm && (
              <div 
                className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                  selectableItems[focusedIndex]?.value === "" 
                    ? "bg-slate-700 text-white" 
                    : !value 
                      ? "text-emerald-400 font-semibold bg-emerald-500/10 hover:bg-slate-800" 
                      : "text-slate-300 hover:bg-slate-800"
                }`}
                onClick={() => { onChange(""); setIsOpen(false); }}
              >
                {placeholder}
              </div>
            )}
            
            {hasGroups ? (
              Object.entries(groupedOptions).map(([group, opts]) => (
                <div key={group} className="mt-2">
                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900/40">
                    {group}
                  </div>
                  {opts.map(opt => {
                    const isFocused = selectableItems[focusedIndex]?.value === opt.value;
                    return (
                      <div 
                        key={opt.value}
                        className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                          isFocused ? "bg-slate-700 text-white" :
                          opt.value === value 
                            ? "bg-emerald-500/10 text-emerald-400 font-semibold hover:bg-slate-800" 
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                        onClick={() => { onChange(opt.value); setIsOpen(false); }}
                      >
                        {opt.label}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="mt-1">
                {filteredOptions.map(opt => {
                  const isFocused = selectableItems[focusedIndex]?.value === opt.value;
                  return (
                    <div 
                      key={opt.value}
                      className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                        isFocused ? "bg-slate-700 text-white" :
                        opt.value === value 
                          ? "bg-emerald-500/10 text-emerald-400 font-semibold hover:bg-slate-800" 
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                      onClick={() => { onChange(opt.value); setIsOpen(false); }}
                    >
                      {opt.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Clear Button */}
      {value && (
        <button 
          onClick={() => onChange("")} 
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
          title="Clear filter"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
