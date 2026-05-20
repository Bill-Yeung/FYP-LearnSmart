import { useState, useRef, useCallback, useEffect } from "react"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { TextField } from "../form/TextField"
import { useToast } from "../../contexts/ToastContext"
import { UPLOAD } from "../../../../../shared/constants"
import { cn } from "../../../../../shared/utils"
import { apiClient } from "../../lib/api"
import { logActivity } from "../../lib/activityLog"

type Subject = { id: string; code: string; name: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DocumentUploadModal({ isOpen, onClose, onSuccess }: Props) {

  const { showToast } = useToast()
  const [uploadMode, setUploadMode] = useState<"file" | "text">("file")
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [textContent, setTextContent] = useState("")
  const [title, setTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])
  const [subjectSearch, setSubjectSearch] = useState("")

  // load subject list when the modal opens
  useEffect(() => {
    if (!isOpen) return
    apiClient.get<Subject[]>("/api/subjects")
      .then(data => setSubjects(data ?? []))
      .catch(() => {})
  }, [isOpen])

  function resetForm() {
    setFiles([])
    setTextContent("")
    setTitle("")
    setSelectedSubjectIds([])
    setSubjectSearch("")
    setError(null)
    setUploadMode("file")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  const validateFile = useCallback((f: File): string | null => {
    if (f.size > UPLOAD.maxFileSize) {
      return `File too large. Maximum size is ${Math.round(UPLOAD.maxFileSize / 1024 / 1024)}MB`
    }
    return null
  }, [])

  const handleFileSelect = useCallback((newFiles: File[]) => {
    const validFiles: File[] = []
    for (const f of newFiles) {
      const validationError = validateFile(f)
      if (validationError) {
        setError(validationError)
        continue
      }
      validFiles.push(f)
    }
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
      setError(null)
    }
  }, [validateFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) handleFileSelect(droppedFiles)
  }, [handleFileSelect])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : []
    if (selectedFiles.length > 0) handleFileSelect(selectedFiles)
  }, [handleFileSelect])

  // send the file or text to the server
  async function handleUpload() {
    if (uploadMode === "file" && files.length === 0) {
      setError("Please select at least one file to upload")
      return
    }
    if (uploadMode === "text" && !textContent.trim()) {
      setError("Please enter some text content")
      return
    }
    if (uploadMode === "text" && !title.trim()) {
      setError("Please enter a title")
      return
    }

    setUploading(true)
    setError(null)

    try {
      if (uploadMode === "text") {
        const formData = new FormData()
        formData.append("title", title.trim())
        formData.append("is_public", "false")
        formData.append("content", textContent)
        if (selectedSubjectIds.length > 0) formData.append("subject_ids", selectedSubjectIds.join(","))

        await apiClient.upload("/api/documents/upload", formData)
        showToast(`"${title}" uploaded successfully! Processing started.`)
      } else {
        let successCount = 0
        const errors: string[] = []

        for (const file of files) {
          const formData = new FormData()
          formData.append("file", file)
          formData.append("is_public", "false")
          if (selectedSubjectIds.length > 0) formData.append("subject_ids", selectedSubjectIds.join(","))

          try {
            await apiClient.upload("/api/documents/upload", formData)
            successCount++
          } catch (err) {
            errors.push(`${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`)
          }
        }

        if (successCount > 0) {
          showToast(`${successCount} file(s) uploaded successfully! Processing started.`)
        }
        if (errors.length > 0) {
          setError(errors.join("\n"))
          return
        }
      }

      logActivity("document", "upload", undefined, {
        mode: uploadMode,
        title: uploadMode === "text" ? title.trim() : undefined,
        fileCount: uploadMode === "file" ? files.length : undefined,
      })
      resetForm()
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function clearFiles() {
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Document" size="lg">
      {/* Upload Mode Toggle */}
      <div className="mb-6">
        <div className="flex rounded-lg border border-gray-200 p-1 dark:border-gray-700">
          <button
            onClick={() => setUploadMode("file")}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              uploadMode === "file"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            )}
          >
            Upload File
          </button>
          <button
            onClick={() => setUploadMode("text")}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              uploadMode === "text"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            )}
          >
            Enter Text
          </button>
        </div>
      </div>

      {/* File Upload Zone */}
      {uploadMode === "file" && (
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Document Files
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors",
              isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : files.length > 0
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
            )}
          >
            <UploadIcon className="mb-2 h-10 w-10 text-gray-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Drag and drop files here
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              or click to browse
            </p>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              PDF, Word, Excel, PowerPoint, Images, Audio, Video, ZIP (max 50MB each)
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              ZIP files will be extracted and each file processed separately
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD.acceptAll}
            onChange={handleFileInputChange}
            className="hidden"
            multiple
          />

          {/* Selected files list */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {files.length} file(s) selected
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    clearFiles()
                  }}
                  className="text-sm text-red-500 hover:text-red-600"
                >
                  Clear all
                </button>
              </div>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-gray-900 dark:text-white">{file.name}</span>
                    <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Text Input */}
      {uploadMode === "text" && (
        <div className="mb-6">
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for this document"
          />
        </div>
      )}

      {uploadMode === "text" && (
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Text Content
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Paste or type your text content here..."
            rows={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:border-blue-400"
          />
        </div>
      )}

      {/* Subject Selector */}
      {subjects.length > 0 && (
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Subjects <span className="font-normal text-gray-400">(optional, select multiple)</span>
          </label>
          <div className="rounded-lg border border-gray-300 dark:border-gray-600">
            <input
              type="text"
              value={subjectSearch}
              onChange={(e) => setSubjectSearch(e.target.value)}
              placeholder="Search subjects..."
              className="w-full border-b border-gray-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-gray-400 dark:border-gray-600 dark:text-white"
            />
            <div className="max-h-36 overflow-y-auto">
              {subjects
                .filter(s => subjectSearch === "" || s.name.toLowerCase().includes(subjectSearch.toLowerCase()) || s.code.toLowerCase().includes(subjectSearch.toLowerCase()))
                .map(s => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedSubjectIds.includes(s.id)}
                    onChange={() => {
                      setSelectedSubjectIds(prev =>
                        prev.includes(s.id)
                          ? prev.filter(id => id !== s.id)
                          : [...prev, s.id]
                      )
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-gray-900 dark:text-white">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          {selectedSubjectIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedSubjectIds.map(id => {
                const subj = subjects.find(s => s.id === id)
                return subj ? (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                  >
                    {subj.name}
                    <button
                      type="button"
                      onClick={() => setSelectedSubjectIds(prev => prev.filter(sid => sid !== id))}
                      className="ml-0.5 text-purple-500 hover:text-purple-700"
                    >
                      &times;
                    </button>
                  </span>
                ) : null
              })}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Concepts extracted from this document will be linked to the selected subjects
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          disabled={uploading || (uploadMode === "file" ? files.length === 0 : !textContent.trim() || !title.trim())}
        >
          {uploading ? "Uploading..." : uploadMode === "file" && files.length > 1 ? "Upload Documents" : "Upload Document"}
        </Button>
      </div>
    </Modal>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}
