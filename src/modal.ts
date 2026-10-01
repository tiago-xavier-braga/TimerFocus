const modal = document.getElementById("modal") as HTMLDialogElement;
const titleEl = document.getElementById("modal-title")!;
const textEl = document.getElementById("modal-text")!;

// Resolves true on "Confirm", false on "Cancel" or Esc.
export function confirm(title: string, text: string): Promise<boolean> {
  titleEl.textContent = title;
  textEl.textContent = text;
  modal.returnValue = "cancel";
  modal.showModal();
  return new Promise((resolve) => {
    modal.addEventListener("close", () => resolve(modal.returnValue === "ok"), { once: true });
  });
}
