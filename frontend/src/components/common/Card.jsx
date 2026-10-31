import React from "react"

export default function Card({
  children,
  className = "",
  interactive = false,
  onClick,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 ${
        interactive
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md active:translate-y-0"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon: Icon,
  className = "",
  children,
}) {
  if (children) {
    return <div className={`border-b border-slate-100 pb-4 mb-4 ${className}`}>{children}</div>
  }

  return (
    <div className={`flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-4 ${className}`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          {title && <h3 className="font-heading font-bold text-slate-900 text-lg">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
