/** O navegador e o sistema (ou o aparelho) lidos de um User-Agent, nulos quando não reconhecidos. */
export interface UserAgentInfo {
  readonly browser: string | null;
  readonly platform: string | null;
}

/**
 * Os navegadores, na ordem em que são conferidos: os que se dizem Chrome ou Safari no User-Agent
 * (Edge, Opera, Chrome) vêm antes deles, e as versões do iOS têm marca própria (CriOS, FxiOS, EdgiOS, OPT).
 */
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\b(?:OPR|OPT|Opera)\//, 'Opera'],
  [/\b(?:Firefox|FxiOS)\//, 'Firefox'],
  [/\b(?:Chrome|CriOS)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
];

/** Os sistemas e os aparelhos, na ordem em que são conferidos: o Android e o ChromeOS antes do Linux. */
const PLATFORMS: readonly (readonly [RegExp, string])[] = [
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

/** O nome da primeira expressão que reconhece o texto, ou nulo. */
function firstMatch(text: string, candidates: readonly (readonly [RegExp, string])[]): string | null {
  return candidates.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** Lê o navegador e o sistema do User-Agent gravado no login (regra 6.1). */
export function readUserAgent(userAgent: string | null): UserAgentInfo {
  if (userAgent === null) return { browser: null, platform: null };
  return { browser: firstMatch(userAgent, BROWSERS), platform: firstMatch(userAgent, PLATFORMS) };
}
