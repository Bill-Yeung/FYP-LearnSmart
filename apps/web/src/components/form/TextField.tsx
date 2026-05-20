import type { InputHTMLAttributes } from "react"

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string | null
}

export function TextField({ label, hint, error, className = "", ...props }: Props) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
      <input
        className={
          "mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none " +
          "bg-white text-gray-900 " +
          "dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800 " +
          "focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 " +
          "disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed " +
          "dark:disabled:bg-gray-900 dark:disabled:text-gray-500 " +
          (error ? "border-red-300 dark:border-red-800" : "") +
          " " +
          className
        }
        {...props}
      />
      {error ? (
        <span className="mt-1 block text-xs text-red-700 dark:text-red-300">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{hint}</span>
      ) : null}
    </label>
  )
}
