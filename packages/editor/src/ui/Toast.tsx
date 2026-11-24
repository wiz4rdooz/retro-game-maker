import { signal } from '@preact/signals';
import { t } from '../strings/de';
import { IconClose } from './icons';

/** Immer nur eine Meldung; eine neue ersetzt die alte. */
export const toast = signal<{ id: number; text: string } | null>(null);

let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 1;

export function showToast(text: string, ms = 7000): void {
  toast.value = { id: nextId++, text };
  clearTimeout(timer);
  timer = setTimeout(() => {
    toast.value = null;
  }, ms);
}

export function Toast() {
  const current = toast.value;
  if (!current) return null;
  return (
    <div role="alert" class="toast" key={current.id}>
      <span>{current.text}</span>
      <button
        type="button"
        class="icon-btn small"
        aria-label={t.toast.schliessen}
        onClick={() => {
          toast.value = null;
        }}
      >
        <IconClose />
      </button>
    </div>
  );
}
