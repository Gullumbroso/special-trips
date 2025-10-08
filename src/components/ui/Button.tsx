import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  fullWidth = true,
  className = "",
  ...props
}: ButtonProps) {
  const baseStyles = "rounded-lg px-6 py-4 text-base font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantStyles = {
    primary: "bg-primary text-black hover:bg-primary/90 active:bg-primary/80",
    secondary: "bg-secondary-button text-foreground hover:bg-secondary-button/80 active:bg-secondary-button/70",
  };

  const widthStyles = fullWidth ? "w-full" : "";

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${widthStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
