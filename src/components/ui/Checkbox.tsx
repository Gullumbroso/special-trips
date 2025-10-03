import { InputHTMLAttributes } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  emoji?: string;
}

export default function Checkbox({ label, emoji, className = "", ...props }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-3 px-4 py-4 rounded-lg border-2 border-secondary/30 bg-secondary/5 cursor-pointer transition-all hover:border-secondary/50 ${props.checked ? "border-secondary bg-secondary/10" : ""} ${className}`}>
      <input
        type="checkbox"
        className="w-5 h-5 rounded accent-secondary cursor-pointer"
        {...props}
      />
      {emoji && <span className="text-xl">{emoji}</span>}
      <span className="font-medium text-foreground">{label}</span>
    </label>
  );
}
