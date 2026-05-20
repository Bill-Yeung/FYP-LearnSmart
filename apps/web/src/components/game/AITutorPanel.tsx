import { useEffect, useRef, useState } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { Card, Button } from "../../components"
import { Bot, Baby, Globe2, Edit3, Sparkles } from "lucide-react"

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  type?: 'text' | 'quiz'
  quizData?: {
    question: string
    options: Record<string, string>
    correctOption: string
    explanation: string
  }
}

interface Props {
  knowledgeId: string
  scriptId?: string
  knowledgeName: string
  contextChunks: string[]
  onInteractionUpdate: (type: 'AI_INTERACTED' | 'QUIZ_PASSED') => void
}

export function AITutorPanel({ knowledgeId, knowledgeName, contextChunks, onInteractionUpdate }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputVal, setInputVal] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
  }, [messages])

  // send a message or a quick-prompt to the AI tutor
  const handleSend = async (customText?: string, promptType?: 'ELI5' | 'EXAMPLES' | 'QUIZ') => {
    const text = customText || inputVal.trim()
    if (!text && !promptType) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: promptType ? `I would like to practice with: ${promptType}` : text
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInputVal('')
    setIsTyping(true)

    onInteractionUpdate('AI_INTERACTED')

    try {
      const response = await fetch('/api/game/ai/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledge_id: knowledgeId,
          knowledge_name: knowledgeName,
          context_chunks: contextChunks,
          is_quiz_mode: promptType === 'QUIZ',
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      })

      const data = await response.json()

      const replyMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || '',
        type: promptType === 'QUIZ' && data.quiz_data ? 'quiz' : 'text',
        quizData: data.quiz_data || undefined
      }
      
      setMessages(prev => [...prev, replyMessage])
    } catch (err) {
      console.error("AI Tutor Request Failed:", err)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I lost connection to my knowledge base. Please try again later.'
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleQuizAnswer = (selectedOption: string, correctOption: string, explanation: string) => {
    const isCorrect = selectedOption === correctOption
    const followUp: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: isCorrect 
        ? `✅ Correct! You chose ${selectedOption}.\n\nExplanation: ${explanation}`
        : `❌ Incorrect. You chose ${selectedOption}, but the answer is ${correctOption}.\n\nExplanation: ${explanation}`
    }
    setMessages(prev => [...prev, followUp])
    
    if (isCorrect) onInteractionUpdate('QUIZ_PASSED')
  }

  return (
    <Card className="flex flex-col h-[600px] p-6">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2 shrink-0">
        <span className="inline-flex items-center gap-2"><Bot className="w-5 h-5 text-indigo-600" /> AI Study Assistant</span>
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex-shrink-0">
        Deep dive into <strong className="text-indigo-500">{knowledgeName}</strong>. Ask me anything, or use the quick prompts below!
      </p>

      {/* Suggested Prompts */}
      <div className="grid grid-cols-3 gap-2 mb-4 flex-shrink-0">
        <button
          type="button"
          onClick={() => handleSend(undefined, 'ELI5')}
          className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wide hover:bg-blue-100 transition-colors py-3 px-3"
        >
          <Baby className="w-4 h-4" /> Explain like I'm 5
        </button>
        <button
          type="button"
          onClick={() => handleSend(undefined, 'EXAMPLES')}
          className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wide hover:bg-emerald-100 transition-colors py-3 px-3"
        >
          <Globe2 className="w-4 h-4" /> Real Examples
        </button>
        <button
          type="button"
          onClick={() => handleSend(undefined, 'QUIZ')}
          className="flex items-center justify-center gap-2 rounded-2xl border border-purple-200 bg-purple-50 text-purple-700 text-xs font-semibold uppercase tracking-wide hover:bg-purple-100 transition-colors py-3 px-3"
        >
          <Edit3 className="w-4 h-4" /> Quick Quiz
        </button>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg mb-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Sparkles className="w-12 h-12 mb-3 text-indigo-400" />
            <p>Start chatting to generate customized RAG learning materials</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-none'
              }`}>
                {msg.type === 'quiz' && msg.quizData ? (
                  <div className="space-y-3">
                    <p className="font-bold text-indigo-700 dark:text-indigo-400">{msg.quizData.question}</p>
                    <div className="flex flex-col gap-2">
                      {Object.entries(msg.quizData.options).map(([key, val]) => (
                        <button 
                          key={key} 
                          type="button"
                          onClick={() => handleQuizAnswer(key, msg.quizData!.correctOption, msg.quizData!.explanation)}
                          className="text-left px-3 py-2 text-xs border border-indigo-200 dark:border-indigo-800 rounded bg-indigo-50/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                          <span className="font-bold mr-2">{key}.</span>{val}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div 
                    className={`${msg.role !== 'user' ? 'prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-gray-100 dark:prose-pre:bg-gray-900 prose-pre:text-gray-800 dark:prose-pre:text-gray-200' : 'text-white'} p-1 pb-4 overflow-x-auto break-words`}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(typeof msg.content === 'string' ? msg.content : '', { breaks: true }) as string) }}
                  />
                )}
              </div>
            </div>
          ))
        )}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1 text-gray-400">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <div className="flex gap-2 flex-shrink-0">
        <textarea
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask a follow-up question... (Press Enter to send)"
          className="flex-1 h-12 px-4 py-3 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button variant="primary" className="!rounded-full px-6" onClick={() => handleSend()}>Send</Button>
      </div>
    </Card>
  )
}
