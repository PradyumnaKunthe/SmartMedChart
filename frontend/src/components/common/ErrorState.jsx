import React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import Button from "./Button"

export default function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this section.",
  onRetry,
  className = "",
}) {
  return (
    <div
      className={`rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center ${className}`}
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="font-heading text-base font-bold text-rose-900">{title}</h3>
      <p className="mt-1 text-sm text-rose-700 max-w-md mx-auto">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            icon={RefreshCw}
            className="border-rose-300 text-rose-800 hover:bg-rose-100/70"
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
