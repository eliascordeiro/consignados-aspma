'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasNewMessage, setHasNewMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatBodyRef = useRef<HTMLDivElement>(null)

  // Auto-scroll para a última mensagem
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Foco no input quando abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  // Mensagem de boas-vindas na primeira abertura
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            '👋 Olá! Sou o **Assistente ASPMA**.\n\nPosso ajudar com dúvidas sobre:\n• 🛒 Nova Venda\n• 📊 Margem consignável\n• 💰 Parcelas e pagamentos\n• 📈 Relatórios\n\nDigite sua dúvida!',
          timestamp: new Date(),
        },
      ])
    }
  }, [isOpen, messages.length])

  const toggleChat = () => {
    setIsOpen(!isOpen)
    setHasNewMessage(false)
  }

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Preparar histórico (sem a welcome message e sem os IDs/timestamps)
      const history = [...messages, userMessage]
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }))

      const response = await fetch('/api/convenio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      const data = await response.json()

      if (response.ok) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])

        // Notificar se o chat estiver fechado
        if (!isOpen) {
          setHasNewMessage(true)
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: '❌ Desculpe, ocorreu um erro. Tente novamente em instantes.',
            timestamp: new Date(),
          },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: '❌ Erro de conexão. Verifique sua internet e tente novamente.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Renderizar markdown simples (bold, listas)
  function renderContent(content: string) {
    return content.split('\n').map((line, i) => {
      // Bullet points
      if (line.startsWith('• ') || line.startsWith('- ')) {
        const text = line.replace(/^[•\-]\s*/, '')
        return (
          <div key={i} className="flex gap-1.5 ml-1">
            <span className="text-primary mt-0.5">•</span>
            <span dangerouslySetInnerHTML={{ __html: formatBold(text) }} />
          </div>
        )
      }
      // Linhas em branco
      if (line.trim() === '') {
        return <div key={i} className="h-2" />
      }
      // Texto normal
      return (
        <p key={i} dangerouslySetInnerHTML={{ __html: formatBold(line) }} />
      )
    })
  }

  function formatBold(text: string): string {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  }

  return (
    <>
      {/* Overlay para fechar no mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 sm:hidden"
          onClick={toggleChat}
        />
      )}

      {/* Chat Panel */}
      <div
        className={`
          fixed z-50 transition-all duration-300 ease-in-out
          ${isOpen 
            ? 'bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[400px] h-[100dvh] sm:h-[520px] opacity-100 scale-100' 
            : 'bottom-6 right-6 w-0 h-0 opacity-0 scale-75 pointer-events-none'
          }
        `}
      >
        <div className="flex flex-col h-full bg-card border border-border rounded-none sm:rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary-foreground/20 rounded-full">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Assistente ASPMA</h3>
                <p className="text-[11px] opacity-80">Suporte inteligente</p>
              </div>
            </div>
            <button
              onClick={toggleChat}
              className="p-1.5 hover:bg-primary-foreground/20 rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={chatBodyRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-background"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="p-1 bg-primary/15 rounded-full">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </div>
                )}
                <div
                  className={`
                    max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                    }
                  `}
                >
                  {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="p-1 bg-muted rounded-full">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="p-1 bg-primary/15 rounded-full">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>
                <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border bg-card px-3 py-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua dúvida..."
                disabled={isLoading}
                className="flex-1 bg-muted text-foreground text-sm rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="p-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
              Powered by IA • Respostas sobre o portal de consignados
            </p>
          </div>
        </div>
      </div>

      {/* FAB (Floating Action Button) */}
      <button
        onClick={toggleChat}
        className={`
          fixed bottom-6 right-6 z-50 
          p-3.5 rounded-full shadow-lg 
          bg-primary text-primary-foreground 
          hover:shadow-xl hover:scale-105
          active:scale-95
          transition-all duration-200
          ${isOpen ? 'opacity-0 scale-0 pointer-events-none' : 'opacity-100 scale-100'}
        `}
        title="Suporte via IA"
      >
        <MessageCircle className="h-5 w-5" />
        
        {/* Badge de nova mensagem */}
        {hasNewMessage && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive rounded-full border-2 border-card animate-pulse" />
        )}
        
        {/* Pulse ring sutil ao entrar na página */}
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-75 pointer-events-none" style={{ animationDuration: '3s', animationIterationCount: '3' }} />
      </button>
    </>
  )
}
