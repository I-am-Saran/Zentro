export default function IconButton({
  children,
  variant = "primary",
  size = "sm",
  title,
  ariaLabel,
  onClick,
  className = "",
  disabled = false,
  ...props
}) {
  const base = "inline-flex items-center justify-center rounded-full transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60 disabled:cursor-not-allowed";
  const sizes = { sm: "w-8 h-8", md: "w-9 h-9" };
  const variants = {
    primary: "bg-[#445A4A] text-white hover:bg-[#3B4E41]",
    outline: "bg-white border border-[#DDE6D5] text-[#445A4A] hover:bg-[#F6F8F5]",
    danger: "bg-white border border-red-200 text-red-600 hover:bg-red-50",
  };
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.sm;
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel || title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${s} ${v} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}