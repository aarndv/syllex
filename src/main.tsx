import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

async function start() {
  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("mockVault") === "1" &&
    !("__TAURI_INTERNALS__" in window)
  ) {
    const { installBrowserMockVault } = await import("./dev/browserMockVault");
    installBrowserMockVault();
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void start();
