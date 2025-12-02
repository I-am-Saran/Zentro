import { Button } from "@material-tailwind/react";

export default function GlossyButton({ className = "", children, variant = "filled", size = "md", disabled = false, ...props }) {
  const baseClasses = "rounded-full transition-all duration-200 ease-out btn-gloss btn-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 font-semibold shadow-md";
  
  const sizeClasses = {
    sm: "px-4 py-1.5 text-sm",
    md: "px-6 py-2.5 text-base",
    lg: "px-8 py-3 text-lg",
  };
  
  const variantClasses = {
    filled: `bg-gradient-to-r from-primary to-primaryLight text-white hover:from-primaryDark hover:to-primary active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed ${
      disabled ? "" : "shadow-lg hover:shadow-xl hover:shadow-accent/20"
    }`,
    outlined: `border-2 border-primary bg-white text-primary hover:bg-primary/5 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed hover:border-accentDark ${
      disabled ? "" : "shadow-md hover:shadow-lg"
    }`,
    text: `bg-transparent text-primary hover:text-accentDark hover:bg-primary/5 active:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed`,
    gradient: `bg-gradient-to-r from-accent to-accentLight text-white hover:from-accentDark hover:to-accent active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:shadow-accent/30`,
  };
  
  const variantClass = variantClasses[variant] || variantClasses.filled;
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  
  return (
    <Button
      {...props}
      disabled={disabled}
      className={`${baseClasses} ${sizeClass} ${variantClass} ${className}`}
    >
      {children}
    </Button>
  );
}