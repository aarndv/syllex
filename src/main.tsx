import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

async function start() {
  const useBrowserMockVault =
    import.meta.env.DEV &&
    !("__TAURI_INTERNALS__" in window) &&
    new URLSearchParams(window.location.search).get("mockVault") !== "0";

  if (useBrowserMockVault) {
    const { installBrowserMockVault } = await import("./dev/browserMockVault");
    installBrowserMockVault();
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App startInVault={useBrowserMockVault} />
    </React.StrictMode>,
  );
}

void start();
