import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { createLoadTracker } from "./loadTracker";
import { getFirstFile, readArtifactFile } from "./viewerShared";

type OnArtifactContent = (content: string, name: string) => void;

export function createLatestArtifactFileReader() {
  const loadTracker = createLoadTracker();

  return async (file: File) => {
    const loadToken = loadTracker.begin();
    const artifact = await readArtifactFile(file);
    return loadTracker.isCurrent(loadToken) ? artifact : null;
  };
}

export function useArtifactFilePicker(onContent: OnArtifactContent) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestArtifactFileReaderRef = useRef<ReturnType<
    typeof createLatestArtifactFileReader
  > | null>(null);

  if (latestArtifactFileReaderRef.current === null) {
    latestArtifactFileReaderRef.current = createLatestArtifactFileReader();
  }

  const handleArtifactFile = useCallback(
    async (file: File) => {
      const artifact = await latestArtifactFileReaderRef.current?.(file);
      if (!artifact) {
        return;
      }

      onContent(artifact.content, artifact.name);
    },
    [onContent],
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

  return { fileInputRef, handleArtifactFile, handleFileSelect };
}

export function useArtifactDropZone(onContent: OnArtifactContent) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { fileInputRef, handleArtifactFile, handleFileSelect } =
    useArtifactFilePicker(onContent);

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
        onContent(text, "pasted.tsx");
      }
    };

    window.addEventListener("paste", handlePasteEvent);
    return () => window.removeEventListener("paste", handlePasteEvent);
  }, [onContent]);

  return {
    containerRef,
    fileInputRef,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    isDragging,
  };
}
