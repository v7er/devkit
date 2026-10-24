import { useCallback, useEffect, useRef, useState } from "react";
import { loadImageFile, type LoadedImage } from "./canvas";

export function useImageFile() {
  const [file, setFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    return () => loaded?.dispose();
  }, [loaded]);

  const load = useCallback(async (files: File[]): Promise<LoadedImage | null> => {
    const next = files[0];
    if (!next) return null;
    setError("");
    setLoading(true);
    try {
      const image = await loadImageFile(next);
      if (!alive.current) {
        image.dispose();
        return null;
      }
      setFile(next);
      setLoaded(image);
      return image;
    } catch (loadError) {
      if (alive.current) {
        setError(loadError instanceof Error ? loadError.message : "Could not open this image.");
      }
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setFile(null);
    setLoaded(null);
    setError("");
  }, []);

  return { file, loaded, error, loading, load, clear };
}
