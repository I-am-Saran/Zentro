export default function FormField({ label, type = "text", value, onChange, options = [], placeholder = "", disabled = false }) {
  const id = `${label?.toLowerCase().replace(/\s+/g, '-')}-field`;
  const baseClass = "w-full rounded-xl border border-[#DDE6D5] px-3 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-primary transition";
  const labelClass = "block text-sm font-medium text-text mb-1";

  if (type === "select") {
    return (
      <div className="grid gap-1">
        {label && <label htmlFor={id} className={labelClass}>{label}</label>}
        <select
          id={id}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={baseClass}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-transparent text-black">
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div className="grid gap-1">
        {label && <label htmlFor={id} className={labelClass}>{label}</label>}
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`min-h-28 ${baseClass}`}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      {label && <label htmlFor={id} className={labelClass}>{label}</label>}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={baseClass}
      />
    </div>
  );
}