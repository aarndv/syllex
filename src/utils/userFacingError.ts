function getErrorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "";
}

/** Converts native and browser failures into concise, non-sensitive recovery guidance. */
export function toUserFacingError(error: unknown, action: string): string {
  const message = getErrorText(error).toLowerCase();

  if (message.includes("does not exist") || message.includes("not found")) {
    return `The requested item is no longer available. Refresh the vault and try ${action} again.`;
  }
  if (message.includes("permission") || message.includes("access is denied")) {
    return `Syllex cannot access that location. Check its folder permissions, then try ${action} again.`;
  }
  if (message.includes("already exists")) {
    return `An item with that name already exists. Choose a different name and try again.`;
  }
  if (
    message.includes("escapes") ||
    message.includes("invalid vault") ||
    message.includes("invalid path") ||
    message.includes("invalid name")
  ) {
    return `That location or name is not allowed. Choose a folder or name inside the selected vault.`;
  }
  if (message.includes("libreoffice")) {
    return "LibreOffice could not prepare this presentation. Install or repair LibreOffice, or open the original file in its system app.";
  }

  return `Unable to ${action}. Try again, or refresh the vault if the problem persists.`;
}
