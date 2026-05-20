import { cn } from "../../../../../shared/utils"

type LogoProps = {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10"
}

export function Logo({ size = "md", className }: LogoProps) {
  return (
    <svg
      className={cn(sizeClasses[size], "text-blue-500", className)}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
