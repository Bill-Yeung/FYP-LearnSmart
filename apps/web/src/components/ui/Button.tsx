import type { ButtonHTMLAttributes, ReactNode } from "react"

type Variant = "primary" | "secondary" | "ghost" | "danger"

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  children: ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = "primary",
  fullWidth = false,
  className = "",
  disabled,
  type = "button",
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium " +
    "transition focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 " +
    "disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"

  const variants: Record<Variant, string> = {
    primary:
      "bg-gray-900 text-white hover:opacity-90 active:opacity-75 " +
      "dark:bg-gray-100 dark:text-gray-900",
    secondary:
      "border bg-white text-gray-900 hover:bg-gray-50 active:bg-gray-100 " +
      "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900 dark:active:bg-gray-800",
    ghost:
      "text-gray-600 hover:underline active:opacity-70 px-0 py-0 rounded-none " +
      "dark:text-gray-300",
    danger:
      "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 " +
      "dark:bg-red-600 dark:hover:bg-red-700 dark:active:bg-red-800",
  }

  const width = fullWidth ? "w-full" : ""

  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${width} ${className}`}
      disabled={disabled}
      {...props}
    />
  )
}
