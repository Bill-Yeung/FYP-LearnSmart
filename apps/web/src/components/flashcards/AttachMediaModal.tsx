import { useState, useEffect } from "react"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { apiClient } from "../../lib/api"

type Props = {
  isOpen: boolean
  onClose: () => void
  onAttach: (attachment: any) => void
  flashcardId?: string
}

export function AttachMediaModal({ isOpen, onClose, onAttach, flashcardId }: Props) {
  const [url, setUrl] = useState("")
  const [type, setType] = useState("image")
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function validateUrl(u: string) {
    try {
      new URL(u)
      return true
    } catch {
      return false
    }
  }

  // attach by url: validate then bubble the attachment to the parent
  function handleAttach() {
    if (!url.trim()) {
      setError("Please provide a URL to attach")
      return
    }
    if (!validateUrl(url.trim())) {
      setError("Please provide a valid URL")
      return
    }

    onAttach({ type, url: url.trim() })
    setUrl("")
    setType("image")
    setError(null)
    onClose()
  }

  async function handleFileUpload() {
    if (!file) {
      setFileError("Please choose a file to upload")
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setFileError("File too large (max 50MB)")
      return
    }
    setFileError(null)
    if (!flashcardId) {
      setError("No flashcard selected")
      return
    }

    setUploading(true)
    setError(null)
    console.log('AttachMediaModal: starting upload', { flashcardId, fileName: file.name, fileSize: file.size })
    try {

      const form = new FormData()
      form.append("file", file)
      form.append("media_type", type)
      form.append("position", "hint")

      const res = await apiClient.upload(`/api/flashcards/${flashcardId}/upload`, form)
      onAttach(res)
      setFile(null)
      setFilePreview(null)
      setType("image")
      onClose()
    } catch (e: any) {
      console.error('AttachMediaModal upload failed', e)
      const msg = e?.message || 'Upload failed'
      setError(msg)
      alert(`Upload failed: ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  // generate a preview for image/video files right after the user picks one
  useEffect(() => {
    if (!file) {
      setFilePreview(null)
      setFileError(null)
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setFileError('File too large (max 50MB)')
      setFilePreview(null)
      return
    }

    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader()
      reader.onload = () => setFilePreview(String(reader.result))
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }, [file])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Attach Media" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Attach an image, audio, or video link to this card.</p>
        <div className="grid gap-2">
          <select value={type} onChange={e => setType(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
            <option value="image">Image</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
            <option value="link">Link</option>
            <option value="website_link">Website Link</option>
          </select>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
          <div className="pt-1">
            <input type="file" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} />
            {file && (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                <div>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>
                {fileError && <div className="text-red-500">{fileError}</div>}
              </div>
            )}
            {filePreview && (
              <div className="mt-2">
                {file.type.startsWith('image/') ? (
                  <img src={filePreview} alt="preview" className="max-h-40 rounded" />
                ) : file.type.startsWith('video/') ? (
                  <video src={filePreview} controls className="max-h-40 rounded" />
                ) : null}
              </div>
            )}
          </div>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            <Button onClick={handleAttach}>Attach URL</Button>
            <Button onClick={handleFileUpload} disabled={uploading}>{uploading ? "Uploading..." : "Upload File"}</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
