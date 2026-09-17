import React from 'react'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  circle?: boolean
}

export function Skeleton({
  width,
  height,
  circle = false,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const customStyle: React.CSSProperties = {
    ...style,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  }

  return (
    <div
      className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 ${
        circle ? 'rounded-full' : 'rounded-2xl'
      } ${className}`.trim()}
      style={customStyle}
      {...props}
    />
  )
}
