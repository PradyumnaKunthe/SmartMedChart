import React, { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react"

import { sendChatMessage } from "../../services/chat"

export default function SmartMedChatbot() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text:
        "Hello! I am SmartMed Clinical Assistant. Ask me about patient records, medications, prescription schedules, STAT doses, or active hospital encounters.",
    },
  ])
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, sending, open])

  async function handleSend(event) {
    event?.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || sending) return

    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: trimmed,
    }

    setMessages((prev) => [...prev, userMsg])
    setMessage("")
    setSending(true)

    try {
      const result = await sendChatMessage(trimmed)
      const botMsg = {
        id: Date.now() + 1,
        sender: "bot",
        text: result?.answer || "I could not locate an answer in the database.",
      }
      setMessages((prev) => [...prev, botMsg])
    } catch (err) {
      const errorMsg =
        err?.response?.data?.detail ||
        err?.message ||
        "Unable to communicate with SmartMed Assistant."
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "bot",
          text: errorMsg,
          error: true,
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const quickQuestions = [
    "What medicines does my assigned patient have?",
    "Show medication schedule for my assigned patient",
    "How many delayed medicines are there currently?",
  ]

  function handleQuickQuestion(q) {
    setMessage(q)
  }

  return (
    <>
      {/* Floating Launcher Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-white shadow-xl shadow-sky-500/25 transition-all duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-sky-500/30 group"
          aria-label="Open SmartMed Assistant"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md group-hover:rotate-12 transition-transform">
            <Sparkles className="h-5 w-5 text-white" />
          </span>

          <span className="hidden text-left sm:block">
            <span className="block text-sm font-bold leading-tight">
              SmartMed AI
            </span>
            <span className="block text-xs text-sky-100">
              Clinical Assistant
            </span>
          </span>
        </button>
      )}

      {/* Expandable Chat Drawer */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(650px,calc(100vh-32px))] w-[min(410px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl transition-all sm:bottom-6 sm:right-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 px-5 py-4 text-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold sm:text-base">
                      SmartMed Assistant
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-sky-100">
                      AI EMR
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-sky-100/90">
                      Connected to Clinical Database
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close Assistant"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4 space-y-3.5">
            {messages.map((chat) => {
              const isUser = chat.sender === "user"
              return (
                <div
                  key={chat.id}
                  className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      isUser
                        ? "rounded-br-sm bg-sky-600 text-white font-medium"
                        : chat.error
                        ? "rounded-bl-sm border border-rose-200 bg-rose-50 text-rose-800"
                        : "rounded-bl-sm border border-slate-200/80 bg-white text-slate-800"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{chat.text}</div>
                  </div>

                  {isUser && (
                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              )
            })}

            {sending && (
              <div className="flex items-start gap-2.5">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-2.5 shadow-2xs flex items-center gap-2">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-sky-600" />
                  <span className="text-xs text-slate-500 font-medium">
                    Searching clinical knowledgebase...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="border-t border-slate-100 bg-white p-3 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Suggested queries
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQuickQuestion(q)}
                  className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-1.5 focus-within:border-sky-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500/10 transition-all">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask clinical question..."
                disabled={sending}
                className="flex-1 bg-transparent px-2.5 py-1.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!message.trim() || sending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 transition-colors"
                aria-label="Send"
              >
                {sending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}