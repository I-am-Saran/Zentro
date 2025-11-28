import { useNavigate } from "react-router-dom";
import GlossyButton from "./GlossyButton";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ className = "", label = "Back", to = -1 }) {
  const navigate = useNavigate();
  return (
    <GlossyButton
      variant="outlined"
      size="sm"
      className={`flex items-center gap-2 ${className}`}
      onClick={() => navigate(to)}
      aria-label={label}
    >
      <ArrowLeft size={16} />
      {label}
    </GlossyButton>
  );
}