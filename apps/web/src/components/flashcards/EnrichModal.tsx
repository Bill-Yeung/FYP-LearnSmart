import { useState, useEffect } from "react"
import { TOKEN_STORAGE_KEY } from "../../../../../shared/constants"
import { apiClient } from "../../lib/api"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import AttachmentPreview from "./AttachmentPreview"
import { jsPDF } from "jspdf"
import { useToast } from "../../contexts"

function isYouTubeUrl(url: string): boolean {
  return !!url.match(
    /(?:[?&]v=|youtu\.be\/|youtube\.com\/(?:embed|shorts)\/)([A-Za-z0-9_-]{11})/
  )
}

type EnrichData = {
  tips?: string
  mnemonic?: string
  attachments?: { type: string; url: string }[]
}

type AttachmentResponse = {
  file_url: string
  media_type?: string
}

type Props = {
  isOpen: boolean
  onClose: () => void
  cardFront?: string
  initialData?: EnrichData
  onSave: (data: EnrichData) => void
  flashcardId?: string
}

export function EnrichModal({ isOpen, onClose, cardFront, initialData, onSave, flashcardId }: Props) {
  const [tips, setTips] = useState(initialData?.tips || "")
  const [attachments, setAttachments] = useState<{ type: string; url: string }[]>(initialData?.attachments || [])
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [newAttachType, setNewAttachType] = useState("link")
  const [newAttachUrl, setNewAttachUrl] = useState("")
  const [attachError, setAttachError] = useState<string | null>(null)
  const [activeAttachment, setActiveAttachment] = useState<{ type: string; url: string } | null>(null)
  const [showAttachmentModal, setShowAttachmentModal] = useState(false)
  const [showExternalAudio, setShowExternalAudio] = useState(false)
  const { showToast } = useToast()

  const [imgPrompt, setImgPrompt] = useState("")
  const [imgWidth, setImgWidth] = useState<number>(512)
  const [imgHeight, setImgHeight] = useState<number>(512)
  const [imgSteps, setImgSteps] = useState<number>(8)
  const [imgGuidance, setImgGuidance] = useState<number>(7.5)
  const [isImgGenerating, setIsImgGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)

  // decide whether to show the preview modal or a separate audio modal
  useEffect(() => {
    if (!activeAttachment) return

    const base = (apiClient as any).baseUrl || ''
    const url = activeAttachment.url && (activeAttachment.url.startsWith('/') || activeAttachment.url.startsWith('/media'))
      ? `${base}${activeAttachment.url}`
      : activeAttachment.url
    const isLocal = !!(activeAttachment.url && (activeAttachment.url.startsWith('/') || activeAttachment.url.startsWith('/media') || (base && url.startsWith(base))))

    if (activeAttachment.type === 'audio' && !isLocal) {
      setShowExternalAudio(true)
      setShowAttachmentModal(false)
    } else {
      setShowAttachmentModal(true)
      setShowExternalAudio(false)
    }
  }, [activeAttachment])

  useEffect(() => {
    if (isOpen) {
      setTips(initialData?.tips || "")
      setAttachments(initialData?.attachments || [])
    }
  }, [isOpen, initialData])

  // add a url-based attachment to the list after validating it
  function handleAddAttachment() {
    if (!newAttachUrl.trim()) return
    if (newAttachType === "video" && !isYouTubeUrl(newAttachUrl.trim())) {
      setAttachError("Only YouTube URLs are supported for video. Please paste a valid YouTube link.")
      return
    }
    setAttachError(null)
    setAttachments(prev => [...prev, { type: newAttachType, url: newAttachUrl.trim() }])
    setNewAttachUrl("")
  }

  async function handleFileUpload() {
    if (!file) {
      setFileError("Please choose a file to upload")
      return
    }
    if (!flashcardId) {
      setFileError("No flashcard selected for upload")
      return
    }

    const f = file

    setUploading(true)
    if (f.size > 50 * 1024 * 1024) {
      setFileError('File too large (max 50MB)')
      setUploading(false)
      return
    }
    setAttachError(null)
    setFileError(null)
    try {
      console.log('EnrichModal: starting upload', { flashcardId, fileName: f.name, fileSize: f.size })

      let uploadFile: File | Blob = f
      if (f.type.startsWith('image/')) {
        const imageFileToPdfBlob = (fileToConvert: File): Promise<Blob> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              if (typeof reader.result !== 'string') return reject(new Error('Failed to read image'))
              const dataUrl = reader.result
              const img = new Image()
              img.onload = () => {
                try {
                  const pdf = new jsPDF()
                  const pageWidth = pdf.internal.pageSize.getWidth()
                  const pageHeight = pdf.internal.pageSize.getHeight()
                  const ratio = Math.min(pageWidth / img.width, pageHeight / img.height)
                  const imgWidth = img.width * ratio
                  const imgHeight = img.height * ratio
                  const x = (pageWidth - imgWidth) / 2
                  const y = (pageHeight - imgHeight) / 2
                  const imgType = fileToConvert.type === 'image/png' ? 'PNG' : 'JPEG'
                  pdf.addImage(dataUrl, imgType as any, x, y, imgWidth, imgHeight)
                  const blob = pdf.output('blob') as Blob
                  resolve(blob)
                } catch (err) { reject(err) }
              }
              img.onerror = () => reject(new Error('Invalid image'))
              img.src = dataUrl
            }
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsDataURL(fileToConvert)
          })
        }

        const pdfBlob = await imageFileToPdfBlob(f)
        const pdfName = f.name.replace(/\.[^/.]+$/, '') + '.pdf'
        uploadFile = new File([pdfBlob], pdfName, { type: 'application/pdf' })
      }

      const form = new FormData()
      form.append("file", uploadFile)
      form.append("media_type", newAttachType)
      form.append("position", "hint")

      const res = await apiClient.upload(`/api/flashcards/${flashcardId}/upload`, form) as AttachmentResponse | undefined
      if (res && res.file_url) {
        setAttachments(prev => [...prev, { type: res.media_type || newAttachType, url: res.file_url }])
      }
      setFile(null)
      setFilePreview(null)
    } catch (e: any) {
      console.error('EnrichModal upload failed', e)
      const msg = e?.message || 'Upload failed'
      setAttachError(msg)
      alert(`Upload failed: ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  // generate a local preview: pdf directly, image wrapped in a pdf
  useEffect(() => {
    if (!file) {
      setFilePreview(null)
      setFileError(null)
      return
    }
    const f = file
    if (f.size > 50 * 1024 * 1024) {
      setFileError('File too large (max 50MB)')
      setFilePreview(null)
      return
    }

    if (f.type === 'application/pdf') {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') setFilePreview(reader.result)
      }
      reader.readAsDataURL(f)
      return () => {
        reader.onload = null
        try { reader.abort() } catch (e) { }
      }
    }

    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') return
        const dataUrl = reader.result
        const img = new Image()
        img.onload = () => {
          try {
            const pdf = new jsPDF()
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            const ratio = Math.min(pageWidth / img.width, pageHeight / img.height)
            const imgWidth = img.width * ratio
            const imgHeight = img.height * ratio
            const x = (pageWidth - imgWidth) / 2
            const y = (pageHeight - imgHeight) / 2
            const imgType = f.type === 'image/png' ? 'PNG' : 'JPEG'
            pdf.addImage(dataUrl, imgType as any, x, y, imgWidth, imgHeight)
            const pdfDataUrl = pdf.output('datauristring')
            setFilePreview(pdfDataUrl)
          } catch (err) {
            console.error('Failed to convert image to PDF', err)
            setFileError('Failed to convert image to PDF')
            setFilePreview(null)
          }
        }
        img.onerror = () => {
          setFileError('Invalid image file')
          setFilePreview(null)
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(f)
      return () => {
        reader.onload = null
        try { reader.abort() } catch (e) { }
      }
    }

    setFilePreview(null)
    setFileError('Only PDF or image files are supported for Enrich (images will be converted to PDF).')
  }, [file])

  function handleRemoveAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    const persistableAttachments = attachments.filter(a => !a.url?.startsWith('data:'))
    onSave({
      tips: tips.trim() || undefined,
      attachments: persistableAttachments.length > 0 ? persistableAttachments : undefined,
    })
    onClose()
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Enrich Content" size="xl">
      <div className="space-y-4">
        {cardFront && (
          <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-900">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Card</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cardFront}</div>
          </div>
        )}


        {/* Image generation for enrichment */}
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <span className="flex items-center gap-2">
              <span>Generate Image (optional)</span>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">Uses Mac Mini FLUX service</span>
            </span>
          </label>
          
          <textarea
            value={imgPrompt}
            onChange={e => setImgPrompt(e.target.value)}
            rows={3}
            placeholder="Describe the image to generate (e.g. 'a red fox in a snowy forest, cinematic')"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />

          {/* Image generation parameters with labels */}
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Width</label>
              <input 
                type="number" 
                value={imgWidth} 
                onChange={e => setImgWidth(Number(e.target.value))} 
                min={256} 
                max={1024} 
                className="w-full rounded border px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900" 
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">256-1024px</p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Height</label>
              <input 
                type="number" 
                value={imgHeight} 
                onChange={e => setImgHeight(Number(e.target.value))} 
                min={256} 
                max={1024} 
                className="w-full rounded border px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900" 
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">256-1024px</p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Steps</label>
              <input 
                type="number" 
                value={imgSteps} 
                onChange={e => setImgSteps(Number(e.target.value))} 
                min={1} 
                max={50} 
                className="w-full rounded border px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900" 
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Quality (1-50)</p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Guidance</label>
              <input 
                type="number" 
                value={imgGuidance} 
                onChange={e => setImgGuidance(Number(e.target.value))} 
                step={0.1} 
                min={0} 
                max={20} 
                className="w-full rounded border px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900" 
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Strength (0-20)</p>
            </div>
          </div>



          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setImgPrompt(""); setGeneratedImage(null) }}>Clear Prompt</Button>
              <Button
                onClick={async () => {
                  if (!imgPrompt.trim()) { showToast('Enter a prompt to generate an image'); return }
                  if (imgWidth < 256 || imgWidth > 1024 || imgHeight < 256 || imgHeight > 1024) { showToast('Width and height must be between 256 and 1024'); return }
                  if (imgSteps < 1 || imgSteps > 50) { showToast('Steps must be between 1 and 50'); return }
                  if (imgGuidance < 1 || imgGuidance > 20) { showToast('Guidance must be between 1 and 20'); return }
                    setIsImgGenerating(true)
                    setGeneratedImage(null)
                    try {
                      const response = await apiClient.post('/api/flashcards/generate-image', {
                        prompt: imgPrompt.trim(),
                        width: imgWidth,
                        height: imgHeight,
                        num_inference_steps: imgSteps,
                        guidance_scale: imgGuidance
                      })
                    
                    const data = response.data || response
                    if (data?.image_base64) {
                      setGeneratedImage(data.image_base64)
                      showToast('Image generated! Click "Attach to Card" to save it.')
                    } else {
                      showToast('No image returned')
                    }
                  } catch (err: any) {
                    const status = err?.response?.status || err?.status
                    const errorMsg = err?.response?.data?.detail || err?.message || String(err)
                    console.error('Image generation failed', err)

                    if (status === 401) {
                      showToast('Please log in to generate images')
                    } else if (status === 503) {
                      if (errorMsg.includes('Mac Mini') || errorMsg.includes('not responding')) {
                        showToast('Mac Mini FLUX service is offline. Please start it on your Mac Mini and ensure port 8001 is accessible.')
                      } else if (errorMsg.includes('not configured')) {
                        showToast('Image generation not configured. Please set FLUX_MODEL environment variable.')
                      } else {
                        showToast(`Service unavailable: ${errorMsg}`)
                      }
                    } else if (status === 502) {
                      showToast('Image generation service error. Check Mac Mini connection and backend logs.')
                    } else {
                      showToast(`Image generation failed: ${errorMsg}`)
                    }
                  } finally {
                    setIsImgGenerating(false)
                  }
                }}
                disabled={isImgGenerating}
              >
                {isImgGenerating ? 'Generating…' : 'Generate Image'}
              </Button>
            </div>
          </div>

          {generatedImage && (
            <div className="mt-4 rounded-lg border-2 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-3">
              <div className="text-sm font-medium text-green-800 dark:text-green-300 mb-3">Generated Image Preview</div>
              <img src={`data:image/png;base64,${generatedImage}`} alt="Generated" className="max-h-48 w-full object-contain rounded mb-3" />
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (!flashcardId) {
                      showToast('No flashcard selected')
                      return
                    }
                    try {
                      const byteString = atob(generatedImage!)
                      const bytes = new Uint8Array(byteString.length)
                      for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i)
                      const blob = new Blob([bytes], { type: 'image/png' })
                      const imgFile = new File([blob], 'generated.png', { type: 'image/png' })
                      const form = new FormData()
                      form.append('file', imgFile)
                      form.append('media_type', 'image')
                      form.append('position', 'hint')
                      const headers: Record<string, string> = {}
                      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
                      const tokens = stored ? JSON.parse(stored) : null
                      if (tokens?.access_token) headers['Authorization'] = `Bearer ${tokens.access_token}`
                      const res = await fetch(`/api/flashcards/${flashcardId}/upload`, {
                        method: 'POST',
                        headers,
                        credentials: 'include',
                        body: form,
                      })
                      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
                      const data = await res.json()
                      if (data?.file_url) {
                        setAttachments(prev => [...prev, { type: 'image', url: data.file_url }])
                        showToast('Image attached to card!')
                      } else {
                        showToast('Upload succeeded but no URL returned')
                      }
                    } catch (err: any) {
                      showToast(err?.message || 'Failed to upload generated image')
                    }
                    setGeneratedImage(null)
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  ✓ Attach to Card
                </Button>
                <a href={`data:image/png;base64,${generatedImage}`} download="generated.png" className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">
                  ⬇ Download
                </a>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attachments</label>

          {attachments.length > 0 && (
            <div className="mb-2 space-y-1">
              {attachments.map((a, i) => {
                const url = a.url && (a.url.startsWith('/') || a.url.startsWith('/media')) ? `${(apiClient as any).baseUrl}${a.url}` : a.url
                const base = (apiClient as any).baseUrl || ''
                const isLocal = !!(a.url && (a.url.startsWith('/') || a.url.startsWith('/media') || url?.startsWith(base)))
                return (
                  <div key={i} className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{a.type}</span>
                        <button
                          onClick={() => {
                            setActiveAttachment({ type: a.type, url })
                          }}
                          className="flex-1 truncate text-blue-600 hover:underline text-left dark:text-blue-400"
                        >
                          {a.url?.startsWith('data:') ? '[local preview — upload to save]' : a.url?.length > 60 ? a.url.slice(0, 60) + '…' : a.url}
                        </button>
                    <button type="button" onClick={() => handleRemoveAttachment(i)} className="text-red-500 hover:text-red-700">✕</button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex gap-2 items-start">
            <select
              value={newAttachType}
              onChange={e => { setNewAttachType(e.target.value); setAttachError(null) }}
              className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="link">Link</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="document">Document</option>
            </select>

            <input
              value={newAttachUrl}
              onChange={e => { setNewAttachUrl(e.target.value); setAttachError(null) }}
              placeholder={newAttachType === "video" ? "YouTube URL only (e.g. https://youtu.be/...)" : "URL"}
              className={`flex-1 rounded border px-2 py-1 text-sm dark:bg-gray-900 dark:text-gray-100 ${attachError ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-700"}`}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddAttachment() } }}
            />

              <div className="pt-1">
              <input type="file" accept="application/pdf,image/*,audio/*,video/*" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} />
              {file && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  <div>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  {fileError && <div className="text-red-500">{fileError}</div>}
                </div>
              )}
              {filePreview && (
                <div className="mt-2">
                  {filePreview.startsWith('data:application/pdf') ? (
                    <embed src={filePreview} type="application/pdf" className="w-full max-h-40 rounded" />
                  ) : file?.type?.startsWith('image/') ? (
                    <img src={filePreview} alt="preview" className="max-h-40 rounded" />
                  ) : file?.type?.startsWith('video/') ? (
                    <video src={filePreview} controls className="max-h-40 rounded" />
                  ) : file?.type?.startsWith('audio/') ? (
                    <audio src={filePreview} controls className="w-full" />
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {attachError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{attachError}</p>}
          {newAttachType === "video" && !attachError && (
            <p className="mt-1 text-xs text-gray-500">Only YouTube links are supported for video attachments.</p>
          )}

          <div className="mt-2 flex gap-2">
            <Button variant="secondary" onClick={handleAddAttachment}>Add URL</Button>
            <Button onClick={handleFileUpload} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload File'}</Button>
            <Button
              variant="ghost"
                onClick={() => {
                // Attach selected local file as a data URL (preview) without uploading
                if (!file || !filePreview) return setFileError('No local file selected to attach')
                const inferredType = filePreview.startsWith('data:application/pdf') ? 'document' : file.type?.startsWith('audio/') ? 'audio' : file.type?.startsWith('image/') ? 'image' : file.type?.startsWith('video/') ? 'video' : newAttachType
                setAttachments(prev => [...prev, { type: inferredType, url: filePreview }])
                setFile(null)
                setFilePreview(null)
                setFileError(null)
              }}
            >
              Attach Selected
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Enrichment</Button>
        </div>
      </div>
      </Modal>

      <Modal isOpen={showAttachmentModal} onClose={() => { setShowAttachmentModal(false); setActiveAttachment(null) }} title="Media" size="sm">
        {activeAttachment && (
          <div>
            <AttachmentPreview url={activeAttachment.url} type={activeAttachment.type} />
          </div>
        )}
      </Modal>

      <Modal isOpen={showExternalAudio} onClose={() => { setShowExternalAudio(false); setActiveAttachment(null) }} title="Audio" size="sm">
        {activeAttachment && (
          <div>
            <audio src={activeAttachment.url} controls autoPlay className="w-full" />
          </div>
        )}
      </Modal>
    </>
  )
}

export default EnrichModal
