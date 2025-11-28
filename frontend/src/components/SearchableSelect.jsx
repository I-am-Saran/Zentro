import { useMemo, useState, useRef, useEffect } from "react";

export default function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  disabled = false,
  required = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => String(opt.label || opt).toLowerCase().includes(term));
  }, [options, q]);

  const baseClass = "w-full rounded-xl border border-[#DDE6D5] px-3 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-primary transition";

  const selectedLabel = useMemo(() => {
    const match = options.find((opt) => (opt.value ?? opt) === value);
    return match ? (match.label || match.value || match) : "";
  }, [options, value]);

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-text mb-1">
          {label}
          {required && <span className="text-primary"> *</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${baseClass} flex items-center justify-between`}
        >
          <span className={selectedLabel ? "text-gray-800" : "text-gray-500"}>
            {selectedLabel || placeholder}
          </span>
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
            <div className="p-2 border-b border-neutral-200">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${label?.toLowerCase() || "options"}...`}
                className="w-full rounded-lg bg-white border border-neutral-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-primary"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value || opt}
                    type="button"
                    onClick={() => {
                      onChange?.(opt.value || opt);
                      setOpen(false);
                      setQ("");
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/10 ${
                      (opt.value || opt) === value ? "bg-accent/20 text-accent" : "text-gray-800"
                    }`}
                  >
                    {opt.label || opt}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}