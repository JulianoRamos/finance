/** O cookie que guarda se a barra lateral está aberta ou recolhida, lido pelo layout no servidor. */
export const SIDEBAR_COOKIE = 'sidebar';

/** O estado da barra lateral: aberta, salvo quando o cookie diz que foi recolhida. */
export function isSidebarExpanded(cookieValue: string | undefined): boolean {
  return cookieValue !== 'collapsed';
}
