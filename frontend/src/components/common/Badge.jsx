import React from "react"

const VARIANTS = {
  primary: "bg-sky-50 text-sky-700 border-sky-200/80",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  warning: "bg-amber-50 text-amber-700 border-amber-200/80",
  danger: "bg-rose-50 text-rose-700 border-rose-200/80",
  purple: "bg-purple-50 text-purple-700 border-purple-200/80",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
}

const SIZES = {
  sm: "px-2 py-0.5 text-[11px] font-semibold",
  md: "px-2.5 py-1 text-xs font-semibold",
  lg: "px-3 py-1.5 text-sm font-semibold",
}

export default function Badge({
  children,
  variant = "neutral",
  size = "md",
  dot = false,
  className = "",
  ...props
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.neutral
  const sizeClass = SIZES[size] || SIZES.md

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border tracking-wide uppercase ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            variant === "success"
              ? "bg-emerald-500"
              : variant === "danger"
              ? "bg-rose-500"
              : variant === "warning"
              ? "bg-amber-500"
              : variant === "primary"
              ? "bg-sky-500"
              : "bg-slate-400"
          }`}
        />
      )}
      {children}
    </span>
  )
}
