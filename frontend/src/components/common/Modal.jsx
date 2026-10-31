import React, { useEffect } from "react"
import { X } from "lucide-react"

export default function Modal({
  open,
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-xl",
  size,
}) {
  const isVisible = Boolean(open ?? isOpen)

  // Support legacy 'size' prop (sm, md, lg, xl, 2xl)
  const sizeMap = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    "2xl": "max-w-5xl",
  }
  const resolvedMaxWidth = (size && sizeMap[size]) || maxWidth

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isVisible) {
        onClose?.()
      }
    }
    if (isVisible) {
      document.body.style.overflow = "hidden"
      window.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      document.body.style.overflow = "unset"
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${resolvedMaxWidth} rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all my-8 z-10`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
          <div>
            {title && (
              <h2 className="font-heading text-xl font-bold text-slate-900">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(85vh-140px)] overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  )
}
