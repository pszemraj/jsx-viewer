declare module "@babel/standalone" {
  export interface TransformResult {
    code?: string | null;
  }

  export interface TransformOptions {
    filename?: string;
    plugins?: unknown[];
    presets?: unknown[];
    sourceType?: "module" | "script" | "unambiguous";
  }

  export function transform(
    code: string,
    options?: TransformOptions,
  ): TransformResult;
}
