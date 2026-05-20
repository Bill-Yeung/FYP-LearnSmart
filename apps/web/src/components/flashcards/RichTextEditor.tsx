import React, { useEffect, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import { Underline } from "@tiptap/extension-underline"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from "@tiptap/extension-text-align"
import { Superscript } from "@tiptap/extension-superscript"
import { Subscript } from "@tiptap/extension-subscript"
import { Placeholder } from '@tiptap/extension-placeholder'

import "katex/dist/katex.min.css"

function ToolbarButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}
    >
      {label}
    </button>
  )
}

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  dataTestId?: string
  minHeight?: string
  maxHeight?: string
}

export function RichTextEditor({ value, onChange, placeholder, dataTestId, minHeight = '200px', maxHeight }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,

      (Placeholder as any).configure({ placeholder: () => placeholder || '', showOnlyWhenEditable: true, includeChildren: true }),
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Superscript,
      Subscript,
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) editor.commands.setContent(value || "")
  }, [value, editor])

  const [isLatexOpen, setIsLatexOpen] = useState(false)
  const [latexInput, setLatexInput] = useState("")
  const [latexCompiling, setLatexCompiling] = useState(false)
  const [latexPreviewUrl, setLatexPreviewUrl] = useState<string | null>(null)
  const [latexError, setLatexError] = useState<string | null>(null)

  function openLatexModal() {
    setLatexInput("")
    setLatexPreviewUrl(null)
    setLatexError(null)
    setIsLatexOpen(true)
  }

  // send latex to the server, display the returned image preview
  async function compileLatexPreview() {
    if (!latexInput.trim()) {
      setLatexError("Enter LaTeX code to preview")
      return
    }

    setLatexCompiling(true)
    setLatexError(null)
    setLatexPreviewUrl(null)

    try {
      const isFullDoc = latexInput.includes('\\documentclass') || 
                       latexInput.includes('\\begin{document}') ||
                       latexInput.includes('\\end{document}')

      const response = await fetch("/api/latex/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          latex_math: latexInput.trim(),
          is_full_document: isFullDoc
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Compilation failed" }))
        setLatexError(error.detail || "Compilation failed")
        return
      }

      const data = await response.json()
      if (data.success && data.image_base64) {
        const mimeType = data.format === "pdf" ? "application/pdf" : "image/png"
        const dataUrl = `data:${mimeType};base64,${data.image_base64}`
        setLatexPreviewUrl(dataUrl)
      } else {
        setLatexError(data.error || "Failed to generate preview")
      }
    } catch (err) {
      setLatexError(`Error: ${(err as any).message || "Network error"}`)
    } finally {
      setLatexCompiling(false)
    }
  }

  

  if (!editor) return null

  return (
    <div data-testid={dataTestId}>
      <style>{`
        .ProseMirror {
          outline: none;
          word-wrap: break-word;
          word-break: break-word;
          white-space: pre-wrap;
          max-width: 100%;
        }
        .ProseMirror p.is-empty:first-child::before,
        .ProseMirror p[data-placeholder]:first-child::before {
          content: attr(data-placeholder);
          color: rgba(156,163,175,1); /* tailwind gray-400 */
          pointer-events: none;
          display: block;
          height: 0;
          margin-bottom: 0.25rem;
          font-style: italic;
        }
        .ProseMirror ul {
          list-style-type: disc;
          margin-left: 1.25rem;
          padding-left: 0;
        }
        .ProseMirror ol {
          list-style-type: decimal;
          margin-left: 1.25rem;
          padding-left: 0;
        }
        .ProseMirror li {
          margin: 0.25rem 0;
        }
        .ProseMirror pre {
          background: #1f2937;
          color: #f8fafc;
          font-family: monospace;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          max-width: 100%;
          white-space: pre;
          margin: 0.5rem 0;
        }
        .ProseMirror code {
          background-color: rgba(150, 150, 150, 0.2);
          color: inherit;
          padding: 0.1em 0.3em;
          border-radius: 0.25rem;
          font-family: monospace;
          word-break: break-all;
        }
        .ProseMirror pre code {
          background-color: transparent;
          color: inherit;
          padding: 0;
          word-break: normal;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
      <div className="rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-sm relative w-full flex flex-col" style={{ maxHeight: maxHeight || '500px' }}>
      <div className="flex-none z-10 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900 shadow-sm rounded-t-md">
        <ToolbarButton active={editor.isActive('bold')} onClick={() => (editor.chain().focus() as any).toggleBold().run()} label={<strong>B</strong>} />
        <ToolbarButton active={editor.isActive('italic')} onClick={() => (editor.chain().focus() as any).toggleItalic().run()} label={<em>I</em>} />
        <ToolbarButton active={editor.isActive('underline')} onClick={() => (editor.chain().focus() as any).toggleUnderline().run()} label={<u>U</u>} />
        <ToolbarButton active={editor.isActive('superscript')} onClick={() => (editor.chain().focus() as any).toggleSuperscript().run()} label={<span>X<sup>2</sup></span>} />
        <ToolbarButton active={editor.isActive('subscript')} onClick={() => (editor.chain().focus() as any).toggleSubscript().run()} label={<span>X<sub>2</sub></span>} />
        <div className="h-6 border-l border-gray-300 dark:border-gray-600"></div>
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => (editor.chain().focus() as any).toggleBulletList().run()} label="• List" />
        <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => (editor.chain().focus() as any).setTextAlign('center').run()} label="Center" />
        <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => (editor.chain().focus() as any).setTextAlign('right').run()} label="Right" />
        <div className="h-6 border-l border-gray-300 dark:border-gray-600"></div>
        <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer" title="Text color">
          <span>A</span>
          <span className="relative flex h-5 w-5 items-center justify-center rounded border border-gray-300 dark:border-gray-600 overflow-hidden">
            <input 
              aria-label="text-color" 
              className="absolute inset-0 opacity-0 text-red-500 cursor-pointer w-full h-full" 
              type="color" 
              onInput={(e) => (editor.chain().focus() as any).setColor((e.target as HTMLInputElement).value).run()} 
              onChange={(e) => (editor.chain().focus() as any).setColor((e.target as HTMLInputElement).value).run()} 
            />
            <span className="text-xs font-bold select-none text-red-700">A</span>
          </span>
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer" title="Highlight color">
          <span>BG</span>
          <span className="relative flex h-5 w-5 items-center justify-center rounded border border-gray-300 dark:border-gray-600 overflow-hidden bg-yellow-200">
            <input 
              aria-label="background-color" 
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
              type="color" 
              onInput={(e) => (editor.chain().focus() as any).toggleHighlight({ color: (e.target as HTMLInputElement).value }).run()}
              onChange={(e) => (editor.chain().focus() as any).toggleHighlight({ color: (e.target as HTMLInputElement).value }).run()} 
            />
          </span>
        </label>
        <div className="h-6 border-l border-gray-300 dark:border-gray-600"></div>
        <button type="button" onClick={openLatexModal} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50">Insert LaTeX</button>
        <button type="button" className="rounded bg-red-100 px-2 py-1 text-xs text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          Reset
        </button>
      </div>

      <div className="flex-1 bg-transparent p-4 overflow-x-hidden overflow-y-auto" style={{ minHeight }}>
        <EditorContent editor={editor} className="max-w-full" />
      </div>
      </div>

      {/* LaTeX modal */}
      {isLatexOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsLatexOpen(false)} />
          <div className="relative z-60 w-full max-w-4xl rounded bg-white p-4 shadow-lg dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Insert LaTeX</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Paste math expressions (e.g., <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">E = mc^2</code>) or full LaTeX documents (starts with <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">\documentclass</code>)
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">LaTeX Code (Math or Full Document)</label>
                <textarea 
                  value={latexInput} 
                  onChange={(e) => {
                    setLatexInput(e.target.value)
                    setLatexPreviewUrl(null)
                    setLatexError(null)
                  }} 
                  className="w-full rounded border p-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 font-mono text-sm" 
                  rows={12}
                  placeholder="Paste math expression (e.g., E = mc^2) or full LaTeX document starting with \documentclass"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={compileLatexPreview}
                    disabled={latexCompiling || !latexInput.trim()}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {latexCompiling ? "Compiling..." : "Preview"}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Live Preview</label>
                <div className="w-full rounded border border-gray-300 dark:border-gray-600 p-4 bg-white dark:bg-gray-900 min-h-48 flex items-center justify-center overflow-auto">
                  {latexError ? (
                    <div className="text-sm text-red-600 dark:text-red-400 text-center">{latexError}</div>
                  ) : latexPreviewUrl ? (
                    <img 
                      src={latexPreviewUrl} 
                      alt="LaTeX preview" 
                      className="max-w-full max-h-full"
                    />
                  ) : (
                    <div className="text-sm text-gray-400">Click "Preview" to see your LaTeX rendered</div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-end gap-2">
              <button 
                className="px-3 py-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                onClick={() => setIsLatexOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                disabled={!latexInput.trim()}
                onClick={() => {
                  if (editor && latexInput.trim()) {
                    const isFullDoc = latexInput.includes('\\documentclass') || 
                                     latexInput.includes('\\begin{document}') ||
                                     latexInput.includes('\\end{document}')
                    
                    let content = ""
                    if (isFullDoc) {
                      content = `[LATEX_DOC]${latexInput.trim()}[/LATEX_DOC]`
                    } else {
                      content = `$${latexInput.trim()}$`
                    }
                    
                    editor.chain().focus().insertContent(content).run()
                    setIsLatexOpen(false)
                  }
                }}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      
    </div>
  )
}

export default RichTextEditor
