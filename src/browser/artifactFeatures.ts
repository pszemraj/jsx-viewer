export interface BrowserArtifactFeatures {
  readonly enableTailwindRuntime: boolean;
}

const TAILWIND_CLASS_PATTERN = /\bclass(Name)?\s*[:=]/;

export function detectBrowserArtifactFeatures(
  source: string,
): BrowserArtifactFeatures {
  return {
    enableTailwindRuntime: TAILWIND_CLASS_PATTERN.test(source),
  };
}
