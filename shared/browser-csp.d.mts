export interface BrowserContentSecurityPolicyOptions {
  readonly inlineScriptHashes?: readonly string[];
}

export const BROWSER_CSP_DIRECTIVES: Record<string, readonly string[]>;

export function computeInlineScriptHash(contents: string): string;

export function buildBrowserContentSecurityPolicy(
  options?: BrowserContentSecurityPolicyOptions,
): string;
