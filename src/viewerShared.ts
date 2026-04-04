export const MONO = '"JetBrains Mono", "Fira Code", "SF Mono", monospace';
export const SANS = '"Inter", -apple-system, "Helvetica Neue", sans-serif';

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function getFirstFile(files: FileList | null | undefined) {
  return files?.item(0) ?? null;
}

export async function readArtifactFile(file: File) {
  return {
    content: await file.text(),
    name: file.name,
  };
}
