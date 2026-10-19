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

const editModal = document.getElementById("edit") as HTMLDialogElement;
const editName = document.getElementById("edit-name") as HTMLInputElement;
const editHours = document.getElementById("edit-hours") as HTMLInputElement;

// Cancel is not a submit button, so Enter in a field submits with "Save".
document.getElementById("edit-cancel")!.addEventListener("click", () => editModal.close());

export interface TaskEdit {
  name: string;
  hours: number;
}

// Resolves the edited fields on "Save", null on "Cancel" or Esc.
export function editPrompt(name: string, hours: number): Promise<TaskEdit | null> {
  editName.value = name;
  editHours.value = String(hours);
  editModal.returnValue = "cancel";
  editModal.showModal();
  editName.select();
  return new Promise((resolve) => {
    editModal.addEventListener(
      "close",
      () => resolve(editModal.returnValue === "ok" ? { name: editName.value.trim(), hours: editHours.valueAsNumber } : null),
      { once: true },
    );
  });
}
