import React from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

const VARIANTS = {
  sky: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-100",
    iconBg: "bg-sky-500/10 text-sky-600",
    glow: "group-hover:border-sky-300",
    bar: "bg-sky-500",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-100",
    iconBg: "bg-emerald-500/10 text-emerald-600",
    glow: "group-hover:border-emerald-300",
    bar: "bg-emerald-500",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-100",
    iconBg: "bg-amber-500/10 text-amber-600",
    glow: "group-hover:border-amber-300",
    bar: "bg-amber-500",
  },
  rose: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-100",
    iconBg: "bg-rose-500/10 text-rose-600",
    glow: "group-hover:border-rose-300",
    bar: "bg-rose-500",
  },
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-100",
    iconBg: "bg-indigo-500/10 text-indigo-600",
    glow: "group-hover:border-indigo-300",
    bar: "bg-indigo-500",
  },
  neutral: {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-100",
    iconBg: "bg-slate-100 text-slate-600",
    glow: "group-hover:border-slate-300",
    bar: "bg-slate-500",
  },
}

export default function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "sky",
  trend,
  trendUp = true,
  badge,
  progress,
  onClick,
  className = "",
}) {
  const scheme = VARIANTS[variant] || VARIANTS.sky
  const isClickable = Boolean(onClick)

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 ${
        scheme.glow
      } ${
        isClickable
          ? "cursor-pointer hover:-translate-y-1 hover:shadow-md active:translate-y-0"
          : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {value}
            </span>
            {trend && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                  trendUp ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {trendUp ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {trend}
              </span>
            )}
            {badge && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${scheme.border} ${scheme.bg} ${scheme.text}`}>
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed truncate">
              {description}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105 ${scheme.iconBg}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {typeof progress === "number" && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
            <span>Capacity</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${scheme.bar}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
