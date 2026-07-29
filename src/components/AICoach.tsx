import { useEffect, useRef, useState } from 'react'
import { useStore } from '../app/store'
import { todayKey } from '../lib/dates'
import {
  buildContextSummary,
  streamChat,
  SYSTEM_PROMPT,
  DEFAULT_COACH_MODEL,
  type ChatMessage,
} from '../lib/aiCoach'

const STARTERS = [
  'What should I focus on today?',
  'Is my weight loss real fat loss?',
  "Why aren't I losing faster?",
  'Should I take a refeed this week?',
  'Where am I losing consistency?',
]

/**
 * Bring-your-own-key LLM chat coach. Renders only when a key is configured;
 * otherwise shows a short setup nudge that points to Settings.
 *
 * Chat history lives in component state — cleared on reload. That is by
 * design: the model always receives the current data context, so old chat
 * history can only mislead once the state has moved on.
 */
export function AICoach() {
  const { state } = useStore()
  const s = state.settings
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom as the reply streams in.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  // Cancel any in-flight request if the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), [])

  // Not configured — surface a nudge, not a chat.
  if (!s.aiCoachEnabled || !s.aiApiKey) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mute">AI Coach chat</h2>
          <span className="text-[11px] text-mute-soft">optional</span>
        </div>
        <p className="mt-2 text-[13px] text-mute">
          Enable in <span className="text-fg">Settings → AI Coach</span> to get a real
          conversational coach. You paste your own Anthropic API key (stored only in this
          browser). Cost with the default model is roughly $0.002 per question.
        </p>
      </div>
    )
  }

  async function send(prompt: string) {
    const text = prompt.trim()
    if (!text || streaming) return
    setError(null)
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setStreaming(true)

    // Append an empty assistant message we'll stream into.
    setMessages((m) => [...m, { role: 'assistant', content: '' }])

    const ac = new AbortController()
    abortRef.current = ac

    try {
      await streamChat({
        apiKey: s.aiApiKey!,
        model: s.aiModel || DEFAULT_COACH_MODEL,
        systemPrompt: SYSTEM_PROMPT,
        context: buildContextSummary(state, todayKey()),
        messages: nextMessages,
        signal: ac.signal,
        onDelta: (delta) => {
          setMessages((m) => {
            const copy = m.slice()
            const last = copy[copy.length - 1]
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = { role: 'assistant', content: last.content + delta }
            }
            return copy
          })
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg !== 'BodyStreamBuffer was aborted' && !ac.signal.aborted) {
        setError(msg)
      }
      // Drop the trailing empty assistant bubble if the request failed.
      setMessages((m) => {
        const last = m[m.length - 1]
        if (last?.role === 'assistant' && last.content === '') return m.slice(0, -1)
        return m
      })
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function cancel() {
    abortRef.current?.abort()
  }

  function reset() {
    if (streaming) cancel()
    setMessages([])
    setError(null)
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-mute">AI Coach chat</h2>
        <div className="flex items-center gap-3 text-[11px] text-mute-soft">
          <span>{s.aiModel?.split('-').slice(1, 3).join(' ') || 'haiku'}</span>
          {messages.length > 0 && (
            <button onClick={reset} className="hover:text-fg">
              Clear
            </button>
          )}
        </div>
      </div>

      {messages.length === 0 && !streaming && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STARTERS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-ink-line bg-ink-soft px-2.5 py-1 text-[12px] text-mute hover:border-accent/40 hover:text-fg"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div
          ref={listRef}
          className="mt-3 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-ink-line bg-ink-soft/40 p-3"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-[13px] leading-relaxed ${
                m.role === 'user' ? 'text-fg' : 'text-mute'
              }`}
            >
              <div
                className={`mb-0.5 text-[10px] uppercase tracking-wide ${
                  m.role === 'user' ? 'text-accent' : 'text-mute-soft'
                }`}
              >
                {m.role === 'user' ? 'You' : 'Coach'}
              </div>
              <div className="whitespace-pre-wrap">
                {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-[12px] text-bad">
          {error}
        </div>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={streaming ? 'Streaming…' : 'Ask anything about your data'}
          disabled={streaming}
          className="field flex-1 text-sm disabled:opacity-60"
        />
        {streaming ? (
          <button type="button" onClick={cancel} className="btn-ghost px-3 text-sm text-bad">
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-primary px-4 text-sm disabled:opacity-40"
          >
            Send
          </button>
        )}
      </form>

      <p className="mt-2 text-[10px] text-mute-soft">
        Sent to api.anthropic.com from your browser using your key. Last 14 days of data included as context.
      </p>
    </div>
  )
}
