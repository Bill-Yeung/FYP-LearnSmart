import { useEffect, useState } from 'react'
import { apiClient } from '../../lib/api'
import { TOKEN_STORAGE_KEY } from '../../../../../shared/constants'

type Props = {
  url: string
  type: string
}

function WebsiteProxyViewer({ url }: { url: string }) {
  // open external website inside an iframe
  const proxyUrl = `/api/flashcards/proxy/website?url=${encodeURIComponent(url)}`
  let hostname = url
  try { hostname = new URL(url).hostname } catch { }
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">{hostname}</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 border border-blue-200 whitespace-nowrap"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open in tab
        </a>
      </div>
      <div className="border border-gray-300 rounded overflow-hidden bg-white dark:bg-gray-900">
        <iframe
          src={proxyUrl}
          title={`Website: ${hostname}`}
          className="w-full"
          style={{ height: '900px' }}
        />
      </div>
    </div>
  )
}

export function AttachmentPreview({ url, type }: Props) {

  if (type === 'website_link') {
    return <WebsiteProxyViewer url={url} />
  }

  const [loading, setLoading] = useState(true)
  const [isPdf, setIsPdf] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [pdfFilename, setPdfFilename] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [inferredFilename, setInferredFilename] = useState<string | undefined>(undefined)
  const [blobMime, setBlobMime] = useState<string | null>(null)

  const resolvedUrl = (url && (url.startsWith('/') || url.startsWith('/media')))
    ? `${(apiClient as any).baseUrl}${url}`
    : url

  function getYouTubeEmbedUrl(videoUrl: string): string | null {
    const patterns = [
      /[?&]v=([A-Za-z0-9_-]{11})/,
      /youtu\.be\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    ]
    for (const pattern of patterns) {
      const match = videoUrl.match(pattern)
      if (match) return `https://www.youtube.com/embed/${match[1]}?autoplay=0&rel=0`
    }
    return null
  }

  function isImageUrl(imageUrl: string): boolean {
    const imageExtensions = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i
    return imageExtensions.test(imageUrl)
  }

  async function downloadResource(fetchUrl: string, filename: string) {
    try {
      const isExternalUrl = /^https?:\/\//i.test(fetchUrl) && !fetchUrl.startsWith(window.location.origin)
      const headers: Record<string, string> = {}
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
      const tokens = stored ? JSON.parse(stored as string) : null
      if (tokens?.access_token && !isExternalUrl) headers['Authorization'] = `Bearer ${tokens.access_token}`
      const resp = await fetch(fetchUrl, { 
        method: 'GET', 
        credentials: isExternalUrl ? 'omit' : 'include', 
        headers 
      })
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`)
      const buf = await resp.arrayBuffer()
      const ct = (resp.headers.get('content-type') || '')
      const blob = new Blob([buf], { type: ct || 'application/octet-stream' })
      const obj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = obj
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(obj), 5000)
    } catch (err) {
      console.error('[AttachmentPreview] downloadResource error', err)
      window.open(fetchUrl, '_blank')
    }
  }

  // load the file when url changes
  useEffect(() => {
    console.log('[AttachmentPreview] Opening attachment - URL:', url, 'Type:', type)
    let mounted = true
    async function probe() {
      setLoading(true)
      setError(null)
      setIsPdf(false)
      setText(null)
      setInferredFilename(undefined)
      setBlobMime(null)
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
        setBlobUrl(null)
      }

      // youtube videos
      const youtubeEmbedUrl = getYouTubeEmbedUrl(url || '')
      if (youtubeEmbedUrl) {
        console.log('[AttachmentPreview] Detected YouTube URL, using iframe')
        setBlobUrl(youtubeEmbedUrl)
        setBlobMime('youtube')
        setLoading(false)
        return
      }

      if (isImageUrl(url || '') && !url?.startsWith('/') && !url?.startsWith('/media')) {
        console.log('[AttachmentPreview] Detected external image URL, using direct src')
        setBlobUrl(url)
        setBlobMime('image/external')
        setLoading(false)
        return
      }

      // other external links
      const isExternalUrl = /^https?:\/\//i.test(url || '') && !url?.startsWith(window.location.origin)
      if (isExternalUrl) {
        const audioExtensions = /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i
        const videoExtensions = /\.(mp4|webm|ogv|mov|avi|mkv)(\?.*)?$/i
        
        if (audioExtensions.test(url || '')) {
          console.log('[AttachmentPreview] Detected external audio URL, using direct src')
          setBlobUrl(url)
          setBlobMime('audio/external')
          setLoading(false)
          return
        }
        
        if (videoExtensions.test(url || '')) {
          console.log('[AttachmentPreview] Detected external video URL, using direct src')
          setBlobUrl(url)
          setBlobMime('video/external')
          setLoading(false)
          return
        }
      }

      if (url && url.startsWith('data:')) {
        try {
          const m = url.match(/^data:([^;,]+)(?:;base64)?,/i)
          const mime = m ? m[1].toLowerCase() : null
          if (mime) setBlobMime(mime)
          setBlobUrl(url)
          setLoading(false)
          return
        } catch (e) {
          console.warn('[AttachmentPreview] Failed to parse data URL', e)
        }
      }

      // fetch the file from server
      try {

        const isExternalUrl = /^https?:\/\//i.test(resolvedUrl) && !resolvedUrl.startsWith(window.location.origin)
        console.log('[AttachmentPreview] Fetching:', resolvedUrl, 'External:', isExternalUrl)
        const headers: Record<string, string> = {}
        const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
        const tokens = stored ? JSON.parse(stored as string) : null
        if (tokens?.access_token && !isExternalUrl) headers['Authorization'] = `Bearer ${tokens.access_token}`

        const res = await fetch(resolvedUrl, { 
          method: 'GET', 
          credentials: isExternalUrl ? 'omit' : 'include', 
          headers 
        })
        console.log('[AttachmentPreview] Fetch response - status:', res.status, 'ok:', res.ok, 'content-type:', res.headers.get('content-type'))
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`)
        const ct = (res.headers.get('content-type') || '').toLowerCase()

        const cd = res.headers.get('content-disposition') || ''
        const m = cd.match(/filename\*?=([^;]+)/i) as RegExpMatchArray | null
        let filename: string | undefined
        if (m) {
          filename = m[1].trim().replace(/^UTF-8''/, '').replace(/^"|"$/g, '')
        }
        if (filename) {
          setPdfFilename(filename)
          setInferredFilename(filename)
        } else {
          try {
            const u = new URL(resolvedUrl, window.location.href)
            const p = u.pathname.split('/').pop() || undefined
            if (p) setInferredFilename(p)
          } catch {
          }
        }

        const hasUsefulType = ct && !ct.includes('application/octet-stream')
        const filenameLooksPdf = filename ? filename.toLowerCase().endsWith('.pdf') : false
        const looksLikePdf = ct.includes('pdf') || resolvedUrl.toLowerCase().endsWith('.pdf') || filenameLooksPdf

        if (hasUsefulType && looksLikePdf) {
          const buf = await res.arrayBuffer()
          if (!mounted) return
          const peek = new Uint8Array(buf.slice(0, 8))
          const startsWithPdf = peek.length >= 4 && peek[0] === 0x25 && peek[1] === 0x50 && peek[2] === 0x44 && peek[3] === 0x46
          if (startsWithPdf) {
            const pdfBlob = new Blob([buf], { type: 'application/pdf' })
            const obj = URL.createObjectURL(pdfBlob)
            setBlobUrl(obj)
            setBlobMime('application/pdf')
            setIsPdf(true)
            setLoading(false)
            return
          }

          try {
            const retryHeaders: Record<string, string> = { Accept: 'application/pdf' }
            const stored2 = localStorage.getItem(TOKEN_STORAGE_KEY)
            const tokens2 = stored2 ? JSON.parse(stored2 as string) : null
            if (tokens2?.access_token && !isExternalUrl) retryHeaders['Authorization'] = `Bearer ${tokens2.access_token}`
            const retry = await fetch(resolvedUrl, { 
              method: 'GET', 
              credentials: isExternalUrl ? 'omit' : 'include', 
              headers: retryHeaders 
            })
            if (retry.ok) {
              const rct = (retry.headers.get('content-type') || '').toLowerCase()
              if (rct.includes('pdf')) {
                const rbuf = await retry.arrayBuffer()
                if (!mounted) return
                const pdfBlob = new Blob([rbuf], { type: 'application/pdf' })
                const obj = URL.createObjectURL(pdfBlob)
                setBlobUrl(obj)
                setBlobMime('application/pdf')
                setIsPdf(true)
                setLoading(false)
                return
              }
            }
          } catch (err) {
            console.debug('[AttachmentPreview] PDF retry failed', err)
          }

          try {
            const txt = new TextDecoder().decode(new Uint8Array(buf))
            if (!mounted) return
            setText(txt)
            setLoading(false)
            return
          } catch (err) {
            console.error('[AttachmentPreview] Failed to decode fallback text', err)
          }
        }
       
        if (hasUsefulType && (ct.startsWith('text/') || ct.includes('json')) && !looksLikePdf) {
          const txt = await res.text()
          if (!mounted) return
          setText(txt)
          setLoading(false)
          return
        }

        if (hasUsefulType && (ct.startsWith('image/') || ct.startsWith('audio/') || ct.startsWith('video/'))) {
          const blob = await res.blob()
          if (!mounted) return
          const obj = URL.createObjectURL(blob)
          setBlobUrl(obj)
          setBlobMime(blob.type || null)
          setLoading(false)
          return
        }

        // figure out file type from the bytes
        const arr = new Uint8Array(await res.arrayBuffer())
        console.log('[AttachmentPreview] Bytes length:', arr.length, 'First bytes:', Array.from(arr.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '))
        if (!mounted) return

        function startsWith(seq: number[]) {
          if (arr.length < seq.length) return false
          for (let i = 0; i < seq.length; i++) if (arr[i] !== seq[i]) return false
          return true
        }

        if (startsWith([0x25, 0x50, 0x44, 0x46])) {
          console.log('[AttachmentPreview] Detected PDF from bytes')
          const blob = new Blob([arr], { type: 'application/pdf' })
          const obj = URL.createObjectURL(blob)
          console.log('[AttachmentPreview] Created blob URL:', obj)
          setBlobUrl(obj)
          if (!pdfFilename && filename) setPdfFilename(filename)
          setBlobMime('application/pdf')
          setIsPdf(true)
          setLoading(false)
          return
        }

        if (startsWith([0x89, 0x50, 0x4e, 0x47])) {
          const blob = new Blob([arr], { type: 'image/png' })
          const obj = URL.createObjectURL(blob)
          setBlobUrl(obj)
          setBlobMime('image/png')
          setLoading(false)
          return
        }

        if (startsWith([0xff, 0xd8, 0xff])) {
          const blob = new Blob([arr], { type: 'image/jpeg' })
          const obj = URL.createObjectURL(blob)
          setBlobUrl(obj)
          setBlobMime('image/jpeg')
          setLoading(false)
          return
        }

        if (arr.length >= 4 && String.fromCharCode(...arr.slice(0, 4)) === 'GIF8') {
          const blob = new Blob([arr], { type: 'image/gif' })
          const obj = URL.createObjectURL(blob)
          setBlobUrl(obj)
          setBlobMime('image/gif')
          setLoading(false)
          return
        }

        if (arr.length >= 12 && String.fromCharCode(...arr.slice(0, 4)) === 'RIFF' && String.fromCharCode(...arr.slice(8, 12)) === 'WEBP') {
          const blob = new Blob([arr], { type: 'image/webp' })
          const obj = URL.createObjectURL(blob)
          setBlobUrl(obj)
          setBlobMime('image/webp')
          setLoading(false)
          return
        }

        if (startsWith([0x50, 0x4b, 0x03, 0x04])) {

          const cd = res.headers.get('content-disposition') || ''
          const m = cd.match(/filename="?([^";]+)"?/) as RegExpMatchArray | null
          const filename = m ? m[1] : undefined

          const urlLower = resolvedUrl.toLowerCase()
          const filenameLower = filename ? filename.toLowerCase() : ''
          const looksLikePptx = filenameLower.endsWith('.pptx') || urlLower.endsWith('.pptx')
          if (looksLikePptx) {
            try {
              const pdfUrl = resolvedUrl.replace(/\.pptx(\?|$)/i, '.pdf$1')
              const headHeaders: Record<string, string> = {}
              const stored3 = localStorage.getItem(TOKEN_STORAGE_KEY)
              const tokens3 = stored3 ? JSON.parse(stored3 as string) : null
              if (tokens3?.access_token) headHeaders['Authorization'] = `Bearer ${tokens3.access_token}`
              const head = await fetch(pdfUrl, { method: 'HEAD', credentials: 'include', headers: headHeaders })
              if (head.ok && (head.headers.get('content-type') || '').toLowerCase().includes('pdf')) {
                const pdfGetHeaders: Record<string, string> = {}
                const stored4 = localStorage.getItem(TOKEN_STORAGE_KEY)
                const tokens4 = stored4 ? JSON.parse(stored4 as string) : null
                if (tokens4?.access_token) pdfGetHeaders['Authorization'] = `Bearer ${tokens4.access_token}`
                const pdfRes = await fetch(pdfUrl, { method: 'GET', credentials: 'include', headers: pdfGetHeaders })
                const pdfBlob = await pdfRes.blob()
                if (!mounted) return
                const obj = URL.createObjectURL(pdfBlob)
                setBlobUrl(obj)
                setBlobMime(pdfBlob.type || 'application/pdf')
                setIsPdf(true)
                setLoading(false)
                return
              }
            } catch (err) {
              console.debug('[AttachmentPreview] PDF sibling probe failed', err)
            }
          }

          const blob = new Blob([arr], { type: 'application/zip' })
          const obj = URL.createObjectURL(blob)
          setBlobUrl(obj)
          setBlobMime('application/zip')
          if (filename) setText(`Archive file: ${filename}`)
          else setText('Archive file (pptx/docx/xlsx) — preview not available')
          setLoading(false)
          return
        }

        const fallbackBlob = new Blob([arr], { type: res.headers.get('content-type') || 'application/octet-stream' })
        const obj = URL.createObjectURL(fallbackBlob)
        setBlobUrl(obj)
        setBlobMime(fallbackBlob.type || null)

      // fallback if fetch fails
      } catch (e) {
        console.error('[AttachmentPreview] Error:', e)

        const isExternalUrl = /^https?:\/\//i.test(resolvedUrl) && !resolvedUrl.startsWith(window.location.origin)
        
        if (isExternalUrl && (type === 'image' || isImageUrl(resolvedUrl))) {
          console.log('[AttachmentPreview] Fetch failed for external image, trying direct image source')
          setBlobUrl(resolvedUrl)
          setBlobMime('image/external')
          setLoading(false)
          return
        }
        
        const audioExtensions = /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i
        if (isExternalUrl && (type === 'audio' || audioExtensions.test(resolvedUrl))) {
          console.log('[AttachmentPreview] Fetch failed for external audio, trying direct audio source')
          setBlobUrl(resolvedUrl)
          setBlobMime('audio/external')
          setLoading(false)
          return
        }
        
        const videoExtensions = /\.(mp4|webm|ogv|mov|avi|mkv)(\?.*)?$/i
        if (isExternalUrl && (type === 'video' || videoExtensions.test(resolvedUrl))) {
          console.log('[AttachmentPreview] Fetch failed for external video, trying direct video source')
          setBlobUrl(resolvedUrl)
          setBlobMime('video/external')
          setLoading(false)
          return
        }

        if (isExternalUrl) {
          console.log('[AttachmentPreview] Fetch failed for external URL, falling back to iframe embed')
          setBlobUrl(resolvedUrl)
          setBlobMime('website_link')
          setLoading(false)
          return
        }

        setError((e as any)?.message || 'Failed to load preview')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    probe()
    return () => {
      mounted = false
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
      setBlobMime(null)
    }
  }, [url, type])

  if (error) {
    return (
      <div className="rounded bg-red-50 p-3 text-sm text-red-800">
        <div className="font-semibold">Error loading preview</div>
        <div className="text-xs mt-1">{error}</div>
        <a href={resolvedUrl} target="_blank" rel="noreferrer" className="text-xs text-red-600 hover:underline mt-2 block">
          Open in new tab
        </a>
      </div>
    )
  }

  if (loading) return <div className="py-6 text-center text-sm text-gray-500">Loading preview…</div>

  if (blobMime === 'website_link') {
    return <WebsiteProxyViewer url={blobUrl || resolvedUrl} />
  }

  if (blobMime === 'youtube') {
    return (
      <div className="space-y-2">
        <div className="aspect-video rounded overflow-hidden bg-gray-900">
          <iframe
            src={blobUrl || ''}
            title="YouTube video"
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    )
  }

  if (blobMime === 'image/external') {
    return (
      <div className="space-y-2">
        <img src={blobUrl} alt="attachment" className="max-w-full max-h-96 rounded border border-gray-200" />
        <a href={blobUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-blue-600 hover:underline">
          Open in new tab
        </a>
      </div>
    )
  }

  if (blobMime === 'audio/external') {
    return (
      <div className="space-y-2">
        <audio src={blobUrl} controls className="w-full" />
        <a href={blobUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-blue-600 hover:underline">
          Open in new tab
        </a>
      </div>
    )
  }

  if (blobMime === 'video/external') {
    return (
      <div className="space-y-2">
        <video src={blobUrl} controls className="w-full max-h-screen rounded" />
        <a href={blobUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-blue-600 hover:underline">
          Open in new tab
        </a>
      </div>
    )
  }

  if (isPdf) {
    return (
      <div className="w-full space-y-2">
        <div className="flex gap-2 items-center justify-between">
          <div className="text-sm font-semibold text-gray-700">PDF Preview</div>
          <div className="flex gap-2">
              <a
                href={blobUrl || resolvedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 border border-blue-200"
              >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Fullscreen
            </a>
            <a
              href={blobUrl || resolvedUrl}
              onClick={(e) => {
                e.preventDefault()
                downloadResource(blobUrl || resolvedUrl, pdfFilename || 'attachment.pdf')
              }}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 border border-blue-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download
            </a>
          </div>
        </div>
        <div className="border border-gray-300 rounded overflow-hidden bg-gray-100">
          <iframe src={blobUrl || resolvedUrl} title="PDF preview" className="w-full" style={{ height: '800px' }} />
        </div>
      </div>
    )
  }

  if (text !== null) {
    return (
      <div className="max-h-screen overflow-auto bg-gray-50 p-4 text-sm rounded space-y-2">
        <pre className="whitespace-pre-wrap text-gray-800">{text}</pre>
        {blobUrl && (
          <div>
            <a
              href={blobUrl}
              onClick={(e) => {
                e.preventDefault()
                downloadResource(blobUrl, inferredFilename || 'attachment.bin')
              }}
              className="text-sm text-blue-600 hover:underline"
            >Download file</a>
          </div>
        )}
      </div>
    )
  }

  // image / audio / video preview
  if (blobUrl) {
    if (type === 'image' || (blobMime && blobMime.startsWith('image/'))) {
      return (
        <div className="space-y-2">
          <img src={blobUrl} alt="attachment" className="max-w-full max-h-screen rounded border border-gray-200" />
          <a
            href={blobUrl}
            onClick={(e) => {
              e.preventDefault()
              downloadResource(blobUrl, inferredFilename || 'image')
            }}
            className="inline-block text-sm text-blue-600 hover:underline"
          >Download image</a>
        </div>
      )
    }
    if (type === 'audio' || (blobMime && blobMime.startsWith('audio/'))) {
      return (
        <div>
          <audio src={blobUrl} controls className="w-full" />
          <div className="mt-2"><a
            href={blobUrl}
            onClick={(e) => {
              e.preventDefault()
              downloadResource(blobUrl, inferredFilename || 'audio')
            }}
            className="text-sm text-blue-600 hover:underline"
          >Download audio</a></div>
        </div>
      )
    }
    if (type === 'video' || (blobMime && blobMime.startsWith('video/'))) {
      return (
        <div>
          <video src={blobUrl} controls className="w-full max-h-screen rounded" />
          <div className="mt-2"><a
            href={blobUrl}
            onClick={(e) => {
              e.preventDefault()
              downloadResource(blobUrl, inferredFilename || 'video')
            }}
            className="text-sm text-blue-600 hover:underline"
          >Download video</a></div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <div className="text-sm text-gray-700 break-words">Preview not available for this file type.</div>
        <div><a href={blobUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Open or download</a></div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-700 break-words">Preview not available for this file type.</div>
      <div><a href={resolvedUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Open or download</a></div>
    </div>
  )
}

export default AttachmentPreview
