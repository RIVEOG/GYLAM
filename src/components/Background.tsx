import { type ReactNode } from 'react';
import { BG } from '@/lib/images';

interface BackgroundProps {
  variant?: 'auth' | 'dashboard' | 'plain';
  children: ReactNode;
  className?: string;
}

export function Background({ variant = 'plain', children, className = '' }: BackgroundProps) {
  const url = variant === 'auth' ? BG.auth : variant === 'dashboard' ? BG.dashboard : undefined;
  return (
    <div className={`relative min-h-screen ${className}`}>
      {url && (
        <div className="fixed inset-0 -z-10">
          <img src={url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" />
        </div>
      )}
      {!url && <div className="fixed inset-0 -z-10 bg-slate-950" />}
      {children}
    </div>
  );
}
