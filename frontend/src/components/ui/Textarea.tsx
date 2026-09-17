import React from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  showCharCount?: boolean
  containerClassName?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      showCharCount = false,
      maxLength,
      value,
      id,
      disabled,
      rows = 3,
      className = '',
      containerClassName = '',
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const currentLength = typeof value === 'string' ? value.length : 0

    return (
      <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`.trim()}>
        {label ? (
          <div className="flex items-center justify-between">
            <label
              htmlFor={textareaId}
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 select-none"
            >
              {label}
            </label>
            {showCharCount && maxLength ? (
              <span className="text-[11px] text-zinc-400">
                {currentLength}/{maxLength}
              </span>
            ) : null}
          </div>
        ) : null}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          className={`w-full bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 border p-3 text-sm rounded-2xl transition-all duration-150 outline-none placeholder:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed resize-y ${
            error
              ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
              : 'border-zinc-200 dark:border-zinc-800 focus:border-zinc-950 dark:focus:border-white focus:ring-2 focus:ring-zinc-950/10 dark:focus:ring-white/10'
          } ${className}`.trim()}
          {...props}
        />

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

Textarea.displayName = 'Textarea'
