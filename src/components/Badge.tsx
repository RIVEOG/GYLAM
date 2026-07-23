interface BadgeProps {
  children: React.ReactNode;
  bg?: string;
  text?: string;
  dot?: string;
}

export function Badge({ children, bg = 'bg-slate-500/10', text = 'text-slate-400', dot }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${text}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {children}
    </span>
  );
}
