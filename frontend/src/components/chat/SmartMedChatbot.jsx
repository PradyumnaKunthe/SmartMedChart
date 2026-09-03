import {
  Bot,
  CheckCircle2,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react"

import {
  useEffect,
  useRef,
  useState,
} from "react"

import {
  sendChatMessage,
} from "../../services/chat"


export default function SmartMedChatbot() {
  const [open, setOpen] = useState(false)

  const [message, setMessage] =
    useState("")

  const [messages, setMessages] =
    useState([
      {
        id: 1,
        sender: "bot",
        text:
          "Hello! I’m SmartMed Assistant. Ask me about patients, medicines, prescriptions, schedules, STAT medications, or medication status.",
      },
    ])

  const [sending, setSending] =
    useState(false)

  const messagesEndRef =
    useRef(null)

  // ---------------------------------------------------------
  // AUTO SCROLL
  // ---------------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    })
  }, [messages, sending])


  // ---------------------------------------------------------
  // SEND MESSAGE
  // ---------------------------------------------------------

  async function handleSend(event) {
    event?.preventDefault()

    const trimmedMessage =
      message.trim()

    if (!trimmedMessage || sending) {
      return
    }

    const userMessage = {
      id:
        Date.now(),
      sender: "user",
      text: trimmedMessage,
    }

    setMessages((previous) => [
      ...previous,
      userMessage,
    ])

    setMessage("")
    setSending(true)

    try {
      const result =
        await sendChatMessage(
          trimmedMessage,
        )

      const botMessage = {
        id:
          Date.now() + 1,
        sender: "bot",
        text:
          result?.answer ||
          "I could not find an answer.",
      }

      setMessages((previous) => [
        ...previous,
        botMessage,
      ])
    } catch (error) {
      const errorMessage =
        error?.response?.data?.detail ||
        error?.message ||
        "Unable to connect to SmartMed Assistant."

      setMessages((previous) => [
        ...previous,
        {
          id:
            Date.now() + 1,
          sender: "bot",
          text: errorMessage,
          error: true,
        },
      ])
    } finally {
      setSending(false)
    }
  }


  // ---------------------------------------------------------
  // QUICK QUESTIONS
  // ---------------------------------------------------------

  const quickQuestions = [
    "What medicines does PRADYUMNA KUNTHE have?",
    "Show the medication schedule for PRADYUMNA KUNTHE",
    "How many delayed medicines are there?",
  ]


  function handleQuickQuestion(
    question,
  ) {
    setMessage(question)
  }


  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <>
      {/* =====================================================
          FLOATING CHAT BUTTON
      ===================================================== */}

      {!open && (
        <button
          type="button"
          onClick={() =>
            setOpen(true)
          }
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl ring-1 ring-slate-700 transition hover:-translate-y-1 hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-cyan-500/30"
          aria-label="Open SmartMed Assistant"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500">
            <MessageCircle className="h-5 w-5" />
          </span>

          <span className="hidden text-left sm:block">
            <span className="block text-sm font-bold">
              SmartMed Assistant
            </span>

            <span className="block text-xs text-slate-400">
              Ask about your clinical data
            </span>
          </span>
        </button>
      )}


      {/* =====================================================
          CHAT WINDOW
      ===================================================== */}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(720px,calc(100vh-32px))] w-[min(430px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5 sm:bottom-6 sm:right-6">

          {/* -------------------------------------------------
              HEADER
          ------------------------------------------------- */}

          <div className="bg-slate-950 px-5 py-4 text-white">
            <div className="flex items-center justify-between gap-3">

              <div className="flex min-w-0 items-center gap-3">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500">
                  <Bot className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-bold sm:text-base">
                      SmartMed Assistant
                    </h2>

                    <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />

                    <p className="text-xs text-slate-400">
                      Connected to SmartMedChart
                    </p>
                  </div>
                </div>

              </div>


              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close SmartMed Assistant"
              >
                <X className="h-5 w-5" />
              </button>

            </div>
          </div>


          {/* -------------------------------------------------
              INTRO
          ------------------------------------------------- */}

          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-start gap-2">

              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />

              <p className="text-xs leading-5 text-slate-500">
                Ask questions about information available
                inside SmartMedChart. Responses are based on
                the application's database.
              </p>

            </div>
          </div>


          {/* -------------------------------------------------
              MESSAGES
          ------------------------------------------------- */}

          <div className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-4">

            <div className="space-y-4">

              {messages.map(
                (chatMessage) => {
                  const isUser =
                    chatMessage.sender ===
                    "user"

                  return (
                    <div
                      key={
                        chatMessage.id
                      }
                      className={[
                        "flex gap-2.5",
                        isUser
                          ? "justify-end"
                          : "justify-start",
                      ].join(" ")}
                    >

                      {!isUser && (
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-cyan-400">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}


                      <div
                        className={[
                          "max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                          isUser
                            ? "rounded-br-md bg-cyan-600 text-white"
                            : chatMessage.error
                              ? "rounded-bl-md border border-red-200 bg-red-50 text-red-700"
                              : "rounded-bl-md border border-slate-200 bg-white text-slate-700",
                        ].join(" ")}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {chatMessage.text}
                        </div>
                      </div>


                      {isUser && (
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                          <User className="h-4 w-4" />
                        </div>
                      )}

                    </div>
                  )
                },
              )}


              {/* -------------------------------------------------
                  TYPING INDICATOR
              ------------------------------------------------- */}

              {sending && (
                <div className="flex items-start gap-2.5">

                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-cyan-400">
                    <Bot className="h-4 w-4" />
                  </div>

                  <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">

                      <LoaderCircle className="h-4 w-4 animate-spin text-cyan-600" />

                      <span className="text-xs font-medium text-slate-500">
                        SmartMed Assistant is thinking...
                      </span>

                    </div>
                  </div>

                </div>
              )}


              <div
                ref={messagesEndRef}
              />

            </div>
          </div>


          {/* -------------------------------------------------
              QUICK QUESTIONS
          ------------------------------------------------- */}

          <div className="border-t border-slate-100 bg-white px-4 pb-2 pt-3">

            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Quick questions
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1">

              {quickQuestions.map(
                (question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() =>
                      handleQuickQuestion(
                        question,
                      )
                    }
                    className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {question}
                  </button>
                ),
              )}

            </div>

          </div>


          {/* -------------------------------------------------
              INPUT
          ------------------------------------------------- */}

          <form
            onSubmit={
              handleSend
            }
            className="border-t border-slate-200 bg-white p-3"
          >

            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-500/10">

              <textarea
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault()
                    handleSend(event)
                  }
                }}
                placeholder="Ask SmartMed Assistant..."
                rows={1}
                disabled={sending}
                className="min-h-[42px] max-h-28 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={
                  !message.trim() ||
                  sending
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                {sending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>

            </div>

            <p className="px-2 pt-2 text-[10px] leading-4 text-slate-400">
              SmartMed Assistant provides information from
              SmartMedChart and does not replace clinical judgment.
            </p>

          </form>

        </div>
      )}
    </>
  )
}