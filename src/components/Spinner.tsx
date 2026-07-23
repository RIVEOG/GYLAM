export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="animate-spin rounded-full border-2 border-slate-700 border-t-blue-500"
      style={{ width: size, height: size }}
    />
  );
}

export function FullScreenSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950">
      <Spinner size={32} />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
