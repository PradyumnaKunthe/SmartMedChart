import React from "react"
import { Inbox } from "lucide-react"
import Button from "./Button"

export default function EmptyState({
  icon: Icon = Inbox,
  title = "No data found",
  description = "There are no records matching your request.",
  actionLabel,
  onAction,
  actionIcon,
  className = "",
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-slate-200 bg-white/70 p-10 text-center ${className}`}
    >
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-100">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-heading text-base font-bold text-slate-800">{title}</h3>
      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button
            variant="primary"
            size="sm"
            onClick={onAction}
            icon={actionIcon}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
