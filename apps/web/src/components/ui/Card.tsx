import type { ReactNode, MouseEventHandler, HTMLAttributes } from "react"

type CardProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  children: ReactNode
  onClick?: MouseEventHandler<HTMLDivElement>
  title?: ReactNode
  subtitle?: ReactNode
  rightSlot?: ReactNode
}

type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  children: ReactNode
}

type CardContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export function Card({
  children,
  className = "",
  onClick,
  title,
  subtitle,
  rightSlot,
  ...props
}: CardProps) {

  if (title || subtitle || rightSlot) {
    return (
      <div
        className={`rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950 overflow-hidden ${className}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick?.(e as any) } : undefined}
        {...props}
      >
        {(title || subtitle || rightSlot) && (
          <div className="flex items-start justify-between gap-4 p-6 pb-0">
            <div className="flex-1">
              {title && (
                <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>
            {rightSlot && <div>{rightSlot}</div>}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick?.(e as any) } : undefined}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = "", ...props }: CardHeaderProps) {
  return (
    <div className={`px-6 pt-6 pb-0 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = "", ...props }: CardTitleProps) {
  return (
    <h2 className={`text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 ${className}`} {...props}>
      {children}
    </h2>
  )
}

export function CardContent({ children, className = "", ...props }: CardContentProps) {
  return (
    <div className={`px-6 py-6 pt-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode
}

export function CardDescription({ children, className = "", ...props }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`} {...props}>
      {children}
    </p>
  )
}

