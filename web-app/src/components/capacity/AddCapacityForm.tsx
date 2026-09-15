import { useState, type FormEvent, type ReactElement } from "react";
import type { Operator } from "../../models/operator";

interface AddCapacityFormProps {
  /** Current active roster — used only to compute the next default name, one past the highest existing "Truck N". */
  roster: Operator[];
  onAdd: (name: string, ratePerHour?: number) => Promise<unknown>;
  isAdding: boolean;
  error: Error | null;
}

const DEFAULT_NAME_PREFIX = "Truck";
const DEFAULT_NAME_PATTERN = /^truck\s+(\d+)$/i;

/** One past the highest "Truck N" name already in the roster (0 if none match), so rapid-adding needs no typing and stays distinguishable. */
function nextDefaultName(roster: Operator[]): string {
  const highest = roster.reduce((max, operator) => {
    const match = DEFAULT_NAME_PATTERN.exec(operator.name.trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${DEFAULT_NAME_PREFIX} ${highest + 1}`;
}

/** Name defaults to an auto-incrementing "Truck N" (not unique — just a way to identify a vehicle past its id) so the button can be clicked with no input. Rate defaults to the service's own default (DEFAULT_OPERATOR_RATE_PER_HOUR) when left blank. */
export function AddCapacityForm({ roster, onAdd, isAdding, error }: AddCapacityFormProps): ReactElement {
  const [nameInput, setNameInput] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [rateError, setRateError] = useState<string | null>(null);
  const defaultName = nextDefaultName(roster);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const name = nameInput.trim() || defaultName;

    if (rateInput.trim() === "") {
      setRateError(null);
      await submit(name, undefined);
      return;
    }
    const rate = Number(rateInput);
    if (!Number.isFinite(rate) || rate <= 0) {
      setRateError("Enter a positive number, or leave blank for the default.");
      return;
    }
    setRateError(null);
    await submit(name, rate);
  }

  async function submit(name: string, rate: number | undefined): Promise<void> {
    try {
      await onAdd(name, rate);
      setNameInput("");
      setRateInput("");
    } catch {
      /* error prop (from the caller's mutation state) already surfaces the failure below. */
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="add-capacity-name" className="block text-sm font-medium text-slate-300">
          Name (optional)
        </label>
        <input
          id="add-capacity-name"
          type="text"
          placeholder={defaultName}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="mt-1 w-40 rounded border border-white/10 bg-white/5 px-3 py-2 text-white"
        />
      </div>
      <div>
        <label htmlFor="add-capacity-rate" className="block text-sm font-medium text-slate-300">
          Rate per hour (optional)
        </label>
        <input
          id="add-capacity-rate"
          type="text"
          inputMode="decimal"
          placeholder="Default"
          value={rateInput}
          onChange={(e) => setRateInput(e.target.value)}
          className="mt-1 w-40 rounded border border-white/10 bg-white/5 px-3 py-2 text-white"
        />
      </div>
      <button
        type="submit"
        disabled={isAdding}
        className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {isAdding ? "Adding…" : "Add vehicle"}
      </button>
      {rateError && (
        <p role="alert" className="w-full text-sm text-red-400">
          {rateError}
        </p>
      )}
      {error && (
        <p role="alert" className="w-full text-sm text-red-400">
          {error.message}
        </p>
      )}
    </form>
  );
}
