interface ChipProps {
  children: React.ReactNode;
  className?: string;
}

export default function Chip({ children, className = "" }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm text-black ${className}`}
      style={{ backgroundColor: '#F2F2F7' }}
    >
      {children}
    </span>
  );
}
