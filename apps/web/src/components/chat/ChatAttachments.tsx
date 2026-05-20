import { FileText, Download, Eye } from 'lucide-react'
import { useState } from 'react'

type Attachment = {
  file_id: string
  filename: string
  file_size: number
  file_url: string
  content_type: string
}

type Props = {
  attachments: Attachment[]
  isOwnMessage: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatAttachments({ attachments: rawAttachments, isOwnMessage }: Props) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null)

  const attachments: Attachment[] = typeof rawAttachments === 'string'
    ? JSON.parse(rawAttachments)
    : Array.isArray(rawAttachments) ? rawAttachments : []

  const images = attachments.filter(a => a.content_type?.startsWith('image/'))
  const files = attachments.filter(a => !a.content_type?.startsWith('image/'))

  return (
    <div className="mt-1 space-y-1">
      {/* Image attachments */}
      {images.length > 0 && (
        <div className={`flex flex-wrap gap-1 ${images.length === 1 ? '' : 'grid grid-cols-2'}`}>
          {images.map((img) => (
            <img
              key={img.file_id}
              src={img.file_url}
              alt={img.filename}
              className="rounded-lg max-w-[240px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setExpandedImage(img.file_url)}
            />
          ))}
        </div>
      )}

      {/* File attachments */}
      {files.map((file) => (
        <div
          key={file.file_id}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isOwnMessage
              ? 'bg-white/20'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.filename}</p>
            <p className={`text-xs ${isOwnMessage ? 'opacity-70' : 'text-gray-500 dark:text-gray-400'}`}>
              {formatFileSize(file.file_size)}
            </p>
          </div>
          <a
            href={file.file_url}
            className={`p-1.5 rounded-md transition-colors ${
              isOwnMessage ? 'hover:bg-white/20' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </a>
          <a
            href={file.file_url}
            download={file.filename}
            data-no-preview="true"
            className={`p-1.5 rounded-md transition-colors ${
              isOwnMessage ? 'hover:bg-white/20' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      ))}

      {/* Fullscreen image modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  )
}
