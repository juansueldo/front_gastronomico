import type { ReactNode } from 'react';

interface FormFieldProps {
  label?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <label className="space-y-1">
      {label ? <span className="block text-xs font-medium text-gray-300">{label}</span> : null}
      {children}
      {hint ? <span className="block text-[11px] text-gray-500">{hint}</span> : null}
    </label>
  );
}
