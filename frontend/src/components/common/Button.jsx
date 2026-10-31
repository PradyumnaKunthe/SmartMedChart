import React from "react"
import { Loader2 } from "lucide-react"

const VARIANTS = {
  primary:
    "bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 focus-visible:ring-sky-500 shadow-sm shadow-sky-600/20",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 focus-visible:ring-slate-400 shadow-sm",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500 shadow-sm shadow-emerald-600/20",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500 shadow-sm shadow-rose-600/20",
  outline:
    "border border-sky-300 text-sky-700 bg-sky-50/50 hover:bg-sky-100 active:bg-sky-200/80 focus-visible:ring-sky-400",
  ghost:
    "text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-400",
}

const SIZES = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5 font-medium",
  md: "px-4 py-2 text-sm rounded-xl gap-2 font-semibold",
  lg: "px-5 py-2.5 text-base rounded-xl gap-2.5 font-semibold",
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  className = "",
  type = "button",
  ...props
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.primary
  const sizeClass = SIZES[size] || SIZES.md

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : null}
      <span>{children}</span>
      {!loading && IconRight ? <IconRight className="h-4 w-4 shrink-0" /> : null}
    </button>
  )
}
