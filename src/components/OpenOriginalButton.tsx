import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function OpenOriginalButton({ relativePath, className = "toolbar-btn" }: { relativePath: string; className?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  useEffect(() => { setError(null); setOpening(false); }, [relativePath]);

  async function open() {
    setOpening(true);
    setError(null);
    try {
      await invoke("open_original", { relativePath });
    } catch (failure) {
      setError(typeof failure === "string" ? failure : "Could not open the file. Check that a system application is available.");
    } finally {
      setOpening(false);
    }
  }

  return <span className="open-original-action">
    <button type="button" className={className} onClick={() => { void open(); }} disabled={opening}>
      Open Original
    </button>
    {error && <span role="alert" className="open-original-error">{error}</span>}
  </span>;
}
