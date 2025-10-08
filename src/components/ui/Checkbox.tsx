import { InputHTMLAttributes } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  emoji?: string;
}

export default function Checkbox({ label, emoji, className = "", ...props }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-2.5 px-3 h-[40px] rounded-lg border cursor-pointer transition-all ${props.checked ? "border-secondary/60 bg-secondary/10" : "border-gray-200 bg-white hover:border-gray-300"} ${className}`}>
      <input
        type="checkbox"
        className="w-4 h-4 rounded accent-secondary cursor-pointer"
        {...props}
      />
      {emoji && <span className={`text-base ${props.checked ? "" : "opacity-65"}`}>{emoji}</span>}
      <span className={`font-medium text-foreground ${props.checked ? "" : "opacity-65"}`}>{label}</span>
    </label>
  );
}
