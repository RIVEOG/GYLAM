import { type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  icon?: ReactNode;
}

export function Input({ label, hint, icon, className = '', id, ...rest }: InputProps) {
  const inputId = id || rest.name;
  return (
    <label htmlFor={inputId} className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>}
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>}
        <input
          id={inputId}
          className={`w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${icon ? 'pl-9' : ''} ${className}`}
          {...rest}
        />
      </div>
      {hint && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
    </label>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export function Select({ label, children, className = '', id, ...rest }: SelectProps) {
  const selId = id || rest.name;
  return (
    <label htmlFor={selId} className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>}
      <select
        id={selId}
        className={`w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}
