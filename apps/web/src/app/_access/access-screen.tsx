import type { ReactNode } from 'react';

/**
 * A composição de blocos da capa do design system, com cores que contrastam com o painel `ink` nos
 * dois temas.
 */
function BrandBlocks() {
  const dots = [24, 48, 72].flatMap((cy) => [24, 48, 72, 96].map((cx) => ({ cx, cy })));
  return (
    <svg
      viewBox="0 0 320 200"
      width="320"
      height="200"
      aria-hidden="true"
      className="hidden h-auto max-w-full md:block"
    >
      <rect x="0" y="0" width="120" height="200" rx="6" className="fill-on-primary" />
      {dots.map(({ cx, cy }) => (
        <circle key={`${String(cx)}-${String(cy)}`} cx={cx} cy={cy} r="1.5" className="fill-ink" />
      ))}
      <rect x="136" y="0" width="96" height="96" rx="12" className="fill-chart-1" />
      <rect x="248" y="0" width="72" height="56" rx="6" className="fill-positive" />
      <rect x="248" y="72" width="32" height="24" rx="6" className="fill-warning-strong" />
      <rect x="136" y="112" width="184" height="88" rx="12" className="fill-body" />
    </svg>
  );
}

/**
 * As telas de acesso (design-system.md, seção 4.1): fora da estrutura do app, com o painel do produto
 * à esquerda (no topo, no celular) e o conteúdo centralizado à direita.
 */
export function AccessScreen({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      <section
        aria-label="Finance"
        className="flex flex-col justify-between gap-6 bg-ink p-6 text-on-primary md:gap-10 md:p-10 lg:w-2/5"
      >
        <span className="text-heading-md">Finance</span>
        <BrandBlocks />
        <div className="flex flex-col gap-3">
          <p className="text-heading-lg md:text-kpi">As finanças da família e das empresas dela, num lugar só.</p>
          <p className="text-faint">Cada número com dono: as pessoas físicas, as empresas e a Visão Familiar.</p>
        </div>
      </section>
      <main className="flex flex-1 items-center justify-center px-6 py-10 md:py-16">
        <div className="w-full max-w-form">{children}</div>
      </main>
    </div>
  );
}

/** O título e o subtítulo centralizados de uma tela de acesso. */
export function AccessHeading({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-2 text-center">
      <h1 className="text-heading-lg text-ink">{title}</h1>
      <p>{children}</p>
    </div>
  );
}

/** As classes de foco pelo teclado (design-system.md, seção 5). */
export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** O botão secundário em largura total, como link (design-system.md, seção 4.2). */
export const SECONDARY_LINK = `flex h-11 w-full items-center justify-center rounded-sm border border-hairline-strong bg-surface text-label text-ink hover:bg-surface-subtle ${FOCUS_RING}`;

/** A linha de rodapé de uma tela de acesso. */
export function AccessFootnote({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="text-center text-body-sm text-mute">{children}</p>;
}
