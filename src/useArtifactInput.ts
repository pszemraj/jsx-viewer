import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type RefObject,
} from "react";
import { createLoadTracker } from "./loadTracker";
import { getFirstFile, readArtifactFile, toError } from "./viewerShared";

type OnArtifactContent = (content: string, name: string) => void;
type OnArtifactFileError = (error: Error, file: File) => void;

type LatestArtifactFileReader = ((file: File) => Promise<{
  content: string;
  name: string;
} | null>) & {
  invalidate(): void;
};

export interface ArtifactInputController {
  cancelPending(): void;
  fileInputRef: RefObject<HTMLInputElement>;
  handleArtifactFile(file: File): Promise<void>;
  handleFileSelect(event: ChangeEvent<HTMLInputElement>): void;
  openFilePicker(): void;
  submitText(content: string, name: string): void;
}

export function createLatestArtifactFileReader() {
  const loadTracker = createLoadTracker();

  const readLatestArtifactFile = (async (file: File) => {
    const loadToken = loadTracker.begin();
    try {
      const artifact = await readArtifactFile(file);
      return loadTracker.isCurrent(loadToken) ? artifact : null;
    } catch (error) {
      if (!loadTracker.isCurrent(loadToken)) {
        return null;
      }
      throw error;
    }
  }) as LatestArtifactFileReader;

  readLatestArtifactFile.invalidate = () => {
    loadTracker.begin();
  };

  return readLatestArtifactFile;
}

export async function loadArtifactFile(
  reader: LatestArtifactFileReader,
  file: File,
  onContent: OnArtifactContent,
  onError: OnArtifactFileError,
) {
  try {
    const artifact = await reader(file);
    if (artifact) {
      onContent(artifact.content, artifact.name);
    }
  } catch (error) {
    onError(toError(error), file);
  }
}

export function useArtifactInput(
  onContent: OnArtifactContent,
  onFileError: OnArtifactFileError,
): ArtifactInputController {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestArtifactFileReaderRef = useRef<ReturnType<
    typeof createLatestArtifactFileReader
  > | null>(null);

  if (latestArtifactFileReaderRef.current === null) {
    latestArtifactFileReaderRef.current = createLatestArtifactFileReader();
  }

  const cancelPending = useCallback(() => {
    latestArtifactFileReaderRef.current?.invalidate();
  }, []);

  const submitText = useCallback(
    (content: string, name: string) => {
      cancelPending();
      onContent(content, name);
    },
    [cancelPending, onContent],
  );

  const handleArtifactFile = useCallback(
    async (file: File) => {
      const reader = latestArtifactFileReaderRef.current;
      if (reader) {
        await loadArtifactFile(reader, file, onContent, onFileError);
      }
    },
    [onContent, onFileError],
  );

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = getFirstFile(event.target.files);
      if (file) {
        void handleArtifactFile(file);
      }
      event.target.value = "";
    },
    [handleArtifactFile],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    cancelPending,
    fileInputRef,
    handleArtifactFile,
    handleFileSelect,
    openFilePicker,
    submitText,
  };
}

export function useArtifactDropZone(
  handleArtifactFile: ArtifactInputController["handleArtifactFile"],
  submitText: ArtifactInputController["submitText"],
) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);

      const file = getFirstFile(event.dataTransfer.files);
      if (!file) {
        return;
      }

      await handleArtifactFile(file);
    },
    [handleArtifactFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const handlePasteEvent = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain");
      if (text?.trim()) {
        event.preventDefault();
        submitText(text, "pasted.tsx");
      }
    };

    window.addEventListener("paste", handlePasteEvent);
    return () => window.removeEventListener("paste", handlePasteEvent);
  }, [submitText]);

  return {
    containerRef,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    isDragging,
  };
}
