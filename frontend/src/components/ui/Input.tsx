import React from 'react'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  inputSize?: InputSize
  containerClassName?: string
}

const inputSizeClasses: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl',
  md: 'px-3.5 py-2 text-sm rounded-2xl',
  lg: 'px-4 py-2.5 text-base rounded-2xl',
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      inputSize = 'md',
      id,
      disabled,
      className = '',
      containerClassName = '',
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`.trim()}>
        {label ? (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 select-none"
          >
            {label}
          </label>
        ) : null}

        <div className="relative flex items-center w-full">
          {leftIcon ? (
            <span className="absolute left-3 flex items-center pointer-events-none text-zinc-400">
              {leftIcon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 border transition-all duration-150 outline-none placeholder:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                : 'border-zinc-200 dark:border-zinc-800 focus:border-zinc-950 dark:focus:border-white focus:ring-2 focus:ring-zinc-950/10 dark:focus:ring-white/10'
            } ${inputSizeClasses[inputSize]} ${leftIcon ? 'pl-9' : ''} ${rightIcon ? 'pr-9' : ''} ${className}`.trim()}
            {...props}
          />

          {rightIcon ? (
            <span className="absolute right-3 flex items-center pointer-events-none text-zinc-400">
              {rightIcon}
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <span>⚠</span>
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{helperText}</p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'
