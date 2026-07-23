interface ProgressBarProps {
  value: number;
  color?: string;
  height?: string;
}

export function ProgressBar({ value, color = 'bg-blue-500', height = 'h-2' }: ProgressBarProps) {
  return (
    <div className={`w-full overflow-hidden rounded-full bg-slate-800 ${height}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
