import React, { useEffect, useState } from 'react'

interface LaTeXContent {
  type: 'text' | 'latex' | 'latex_doc'
  content: string
  imageUrl?: string
}

interface Props {
  content: string
  className?: string
}

export const LaTeXRenderer: React.FC<Props> = ({ content, className = '' }) => {
  const [parts, setParts] = useState<LaTeXContent[]>([])
  const [loading, setLoading] = useState(true)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

  // strip any html tags so the latex regex works on plain text
  const extractTextFromHtml = (html: string): string => {
    if (!html) return ''
    
    if (!/<|>/g.test(html)) return html
    
    const div = document.createElement('div')
    div.innerHTML = html
    
    const text = Array.from(div.childNodes)
      .map(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent || ''
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          return (node as HTMLElement).textContent || ''
        }
        return ''
      })
      .join('')
    
    return text
  }

  useEffect(() => {
    const parseContent = async () => {

      const cleanContent = extractTextFromHtml(content)
      
      const textParts: LaTeXContent[] = []
      let lastIndex = 0

      const docRegex = /\[LATEX_DOC\]([\s\S]*?)\[\/LATEX_DOC\]/g
      const docMatches = Array.from(cleanContent.matchAll(docRegex))

      if (docMatches.length > 0) {
        for (const docMatch of docMatches) {

          if (docMatch.index! > lastIndex) {
            textParts.push({
              type: 'text',
              content: cleanContent.substring(lastIndex, docMatch.index)
            })
          }

          const docContent = docMatch[1]
          const docPart: LaTeXContent = {
            type: 'latex_doc',
            content: docContent,
            imageUrl: undefined
          }

          try {
            const response = await fetch('/api/latex/preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ latex_math: docContent, is_full_document: true })
            })

            if (response.ok) {
              const data = await response.json()
              if (data.success && data.image_base64) {
                const mimeType = data.format === 'pdf' ? 'application/pdf' : 'image/png'
                docPart.imageUrl = `data:${mimeType};base64,${data.image_base64}`
              }
            }
          } catch (err) {
            console.error('LaTeX document compilation error:', err)
          }

          textParts.push(docPart)
          lastIndex = docMatch.index! + docMatch[0].length
        }

        if (lastIndex < cleanContent.length) {
          const remaining = cleanContent.substring(lastIndex)
          await parseInlineMath(remaining, textParts)
        }
      } else {
        await parseInlineMath(cleanContent, textParts)
      }

      setParts(textParts)
      setLoading(false)
    }

    async function parseInlineMath(text: string, parts: LaTeXContent[]) {

      const inlineRegex = /\$\$(.+?)\$\$|\$(.+?)\$/g
      let lastIdx = 0
      let match

      const matches = Array.from(text.matchAll(inlineRegex))

      if (matches.length === 0) {
        parts.push({ type: 'text', content: text })
        return
      }

      for (const m of matches) {

        if (m.index! > lastIdx) {
          parts.push({
            type: 'text',
            content: text.substring(lastIdx, m.index)
          })
        }

        const latexCode = m[1] || m[2]
        const latexPart: LaTeXContent = {
          type: 'latex',
          content: latexCode,
          imageUrl: undefined
        }

        try {
          const response = await fetch('/api/latex/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latex_math: latexCode })
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success && data.image_base64) {
              const mimeType = data.format === 'pdf' ? 'application/pdf' : 'image/png'
              latexPart.imageUrl = `data:${mimeType};base64,${data.image_base64}`
            }
          }
        } catch (err) {
          console.error('LaTeX compilation error:', err)
        }

        parts.push(latexPart)
        lastIdx = m.index! + m[0].length
      }

      if (lastIdx < text.length) {
        parts.push({
          type: 'text',
          content: text.substring(lastIdx)
        })
      }
    }

    parseContent()
  }, [content])

  // close the enlarged image modal when the user presses Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEnlargedImage(null)
      }
    }
    
    if (enlargedImage) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [enlargedImage])

  if (loading) {
    return <div className={className}>Loading...</div>
  }

  return (
    <>
      <div className={className}>
        {parts.map((part, idx) => {
          switch (part.type) {
            case 'text':
              return <span key={idx}>{part.content}</span>
            case 'latex_doc':
              return part.imageUrl ? (
                <div key={idx} className="my-4 p-4 bg-gray-50 rounded border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
                  <img
                    src={part.imageUrl}
                    alt="Compiled LaTeX document"
                    className="max-w-full cursor-pointer hover:opacity-75 transition-opacity"
                    style={{ maxHeight: '500px' }}
                    onClick={() => setEnlargedImage(part.imageUrl!)}
                  />
                </div>
              ) : (
                <div key={idx} className="my-4 p-4 bg-gray-100 rounded border border-gray-300 dark:bg-gray-800 dark:border-gray-600">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Compiling LaTeX document...</p>
                </div>
              )
            case 'latex':
              return part.imageUrl ? (
                <img
                  key={idx}
                  src={part.imageUrl}
                  alt={`LaTeX: ${part.content}`}
                  className="inline align-middle max-w-full mx-1 cursor-pointer hover:opacity-75 transition-opacity"
                  style={{ maxHeight: '2rem' }}
                  onClick={() => setEnlargedImage(part.imageUrl!)}
                />
              ) : (
                <span key={idx} className="text-gray-500 italic">${part.content}$</span>
              )
            default:
              return null
          }
        })}
      </div>

      {/* Image enlargement modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 z-10 p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors"
              onClick={() => setEnlargedImage(null)}
              title="Close (press Esc)"
            >
              <svg className="w-6 h-6 text-gray-800 dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={enlargedImage}
              alt="Enlarged LaTeX"
              className="w-full h-auto"
            />
          </div>
        </div>
      )}
    </>
  )
}

export default LaTeXRenderer
