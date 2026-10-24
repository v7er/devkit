export async function copyText(text: string): Promise<void> {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy path when clipboard permission is denied.
    }
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command was rejected");
    }
  } finally {
    area.remove();
  }
}

export async function readClipboard(): Promise<string> {
  if (!navigator.clipboard?.readText) {
    throw new Error("This browser does not allow reading the clipboard");
  }
  return navigator.clipboard.readText();
}
