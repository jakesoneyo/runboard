import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white border-ink",
  accent: "bg-accent text-white border-accent-ink",
  outline: "bg-paper-raised text-ink border-ink hover:-translate-y-px",
  ghost:
    "bg-transparent text-ink border-transparent hover:border-paper-line-strong",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** DESIGN.md 형태락: 항상 각진 모서리(rounded-none) + 1.5px 보더 버튼(variant-c-bold .btn). */
export function Button({
  variant = "outline",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-none border-[1.5px] px-4 py-2.5 text-[13px] font-bold tracking-[0.01em] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
