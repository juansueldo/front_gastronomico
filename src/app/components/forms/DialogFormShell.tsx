import type { ReactNode } from 'react';

interface DialogFormShellProps {
  title: string;
  description?: string;
  error?: string | null;
  children: ReactNode;
}

export function DialogFormShell({
  title,
  description,
  error,
  children,
}: DialogFormShellProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-white">{title}</h2>
        {description ? <p className="text-xs text-gray-400">{description}</p> : null}
      </div>

      {children}

      {error ? (
        <div className="rounded-md border border-red-700/60 bg-red-950/20 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
