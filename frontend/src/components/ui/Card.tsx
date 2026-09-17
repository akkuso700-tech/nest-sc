import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  bordered?: boolean
  children: React.ReactNode
}

export function Card({
  hoverable = false,
  bordered = true,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-3xl bg-white dark:bg-zinc-900 transition-all duration-150 ${
        bordered ? 'border border-zinc-200/80 dark:border-zinc-800' : ''
      } ${
        hoverable ? 'hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700' : 'shadow-sm'
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 pb-3 border-b border-zinc-100 dark:border-zinc-800/80 ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-base font-bold text-zinc-950 dark:text-zinc-50 tracking-tight ${className}`.trim()}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardDescription({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 ${className}`.trim()} {...props}>
      {children}
    </p>
  )
}

export function CardContent({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`p-6 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-3 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  )
}
