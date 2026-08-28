import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const CONTROL_CLASSES =
  "w-full border-[1.5px] border-ink bg-white px-3 py-2.5 text-[13px] text-ink outline-none focus:outline-2 focus:outline-accent focus:outline-offset-1";

/** variant-c-bold .field — 라벨 + 인풋 + 에러/도움말 한 묶음. */
export function Field({
  label,
  htmlFor,
  error,
  helper,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-bold tracking-[0.04em]"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[10.5px] font-bold text-fail">{error}</p>
      ) : helper ? (
        <p className="mt-1 text-[10.5px] text-ink/60">{helper}</p>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${CONTROL_CLASSES} ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${CONTROL_CLASSES} ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${CONTROL_CLASSES} appearance-none ${props.className ?? ""}`}
    />
  );
}
