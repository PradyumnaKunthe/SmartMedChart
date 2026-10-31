import React from "react"
import { Activity, Loader2 } from "lucide-react"

export default function Loading({
  message = "Loading data...",
  subtext = "Please wait a moment",
  fullScreen = false,
  className = "",
}) {
  const content = (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="relative mb-4 flex items-center justify-center">
        <div className="h-14 w-14 rounded-2xl bg-sky-50 flex items-center justify-center shadow-inner">
          <Activity className="h-7 w-7 text-sky-600 animate-pulse" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white shadow-sm flex items-center justify-center">
          <Loader2 className="h-3.5 w-3.5 text-sky-500 animate-spin" />
        </div>
      </div>
      <p className="font-heading font-semibold text-slate-800 text-base">{message}</p>
      {subtext && <p className="mt-1 text-xs text-slate-500 max-w-sm">{subtext}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        {content}
      </div>
    )
  }

  return content
}

export function SkeletonRow({ count = 3 }) {
  return (
    <div className="space-y-3 w-full animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-slate-100/80 w-full" />
      ))}
    </div>
  )
}
