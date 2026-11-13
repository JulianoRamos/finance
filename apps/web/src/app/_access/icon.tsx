import type { ReactNode } from 'react';

/** Um ícone de traço de 1,5px (design-system.md, seção 4), decorativo: o significado vai no texto. */
export function Icon({
  size = 16,
  className,
  children,
}: Readonly<{ size?: number; className?: string; children: ReactNode }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}
