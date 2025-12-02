import { useEffect, useState } from "react";

export default function Toast({ type = "info", message = "", duration = 2500 }) {
  const [open, setOpen] = useState(Boolean(message));
  useEffect(() => {
    if (!message) return;
    setOpen(true);
    const t = setTimeout(() => setOpen(false), duration);
    return () => clearTimeout(t);
  }, [message, duration]);

  if (!open || !message) return null;

  const styles = {
    info: "bg-blue-600",
    success: "bg-emerald-600",
    error: "bg-rose-600",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-white shadow-lg ${styles[type] || styles.info}`}
    >
      {message}
    </div>
  );
}