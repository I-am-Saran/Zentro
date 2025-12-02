export default function Button({
  children,
  variant = "primary",
  size = "md",
  onClick,
  className = "",
  ariaLabel,
  type = "button",
  disabled = false,
  ...props
}) {
  const base = "inline-flex items-center gap-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60 disabled:cursor-not-allowed";

  const sizes = {
    sm: "text-sm px-3 py-1.5",
    md: "text-sm sm:text-base px-4 py-2",
    lg: "text-base px-5 py-2.5",
  };

  const variants = {
    primary: "bg-[#445A4A] text-white hover:bg-[#3B4E41]",
    secondary: "bg-white text-[#445A4A] border border-[#DDE6D5] hover:bg-[#F6F8F5]",
    ghost: "bg-transparent text-[#445A4A] hover:text-[#3B4E41]",
  };

  const vClass = variants[variant] || variants.primary;
  const sClass = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sClass} ${vClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}