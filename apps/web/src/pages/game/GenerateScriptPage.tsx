import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom";
import React from "react"
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Cloud, File, FileText } from "lucide-react"
import { Card, Button } from "../../components"
import { apiClient } from "../../lib/api"
import type { GameTemplateListItem } from "../../api/gameTemplates"
import { ScopeSelector, type KnowledgeModule } from "../../components/form/ScopeSelector"
import { useDocumentUpload } from "../../hooks/useDocumentUpload"
import { useToast } from "../../contexts/ToastContext";
import { analyzeDocument } from "../../components/game/createHelper"
import { getParsedJson } from "../../api/documents"


interface ValidationDetail {
  check_id: string
  check_name: string
  passed: boolean
  severity: "error" | "warning"
  details: string
  failed_items?: string[]
}

interface ValidationSummary {
  passed: boolean
  total_checks: number
  passed_checks: number
  failed_checks: number
  error_checks: number
  warning_checks: number
  details: ValidationDetail[]
}

interface ValidationResultViewProps {
  data: ValidationSummary
}

function normalizeModules(rawModules: unknown): Array<{ name?: string; topic_count?: number; topics?: unknown[] }> {
  if (Array.isArray(rawModules)) return rawModules

  if (typeof rawModules === "string") {
    try {
      const parsed = JSON.parse(rawModules)
      return normalizeModules(parsed)
    } catch (error) {
      console.warn("Failed to parse modules JSON string:", error)
      return []
    }
  }

  if (rawModules && typeof rawModules === "object") {
    const record = rawModules as Record<string, unknown>

    // Handle wrapped response shapes, e.g. { modules: [...] } or { data: { modules: [...] } }
    if ("modules" in record) {
      return normalizeModules(record.modules)
    }
    if ("data" in record) {
      return normalizeModules(record.data)
    }

    return Object.values(record).flatMap((value) => normalizeModules(value))
  }

  return []
}

// render the pass/fail summary card and per-check rows for a validation report
function ValidationResultView({ data }: ValidationResultViewProps) {
  if (!data) return null

  return (
    <div className="space-y-6">
      <div
        className={`flex items-center justify-between rounded-lg border p-4 shadow-sm ${
          data.passed
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20"
            : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20"
        }`}
      >
        <div className="flex items-center gap-3">
          {data.passed ? (
            <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          )}
          <div>
            <h3
              className={`text-lg font-semibold ${
                data.passed
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-red-800 dark:text-red-300"
              }`}
            >
              {data.passed ? "Validation Passed" : "Validation Failed"}
            </h3>
            <p
              className={`text-sm ${
                data.passed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              Checked {data.total_checks} constraints (Errors: {data.error_checks},{" "}
              Warnings: {data.warning_checks})
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Detailed Checks</h4>
        {data.details.map((check) => {
          const isError = !check.passed && check.severity === "error"
          const isWarning = !check.passed && check.severity === "warning"
          const isPass = check.passed

          return (
            <div
              key={check.check_id}
              className={`rounded-lg border p-4 ${
                isPass
                  ? "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-800/50"
                  : isWarning
                  ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20"
                  : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20"
              }`}
            >
              <div className="flex items-start gap-3">
                {isPass && <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />}
                {isWarning && <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />}
                {isError && <XCircle className="mt-0.5 h-5 w-5 text-red-500" />}

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h5
                      className={`font-medium ${
                        isPass
                          ? "text-gray-900 dark:text-gray-100"
                          : isWarning
                          ? "text-amber-800 dark:text-amber-200"
                          : "text-red-800 dark:text-red-200"
                      }`}
                    >
                      {check.check_name}
                    </h5>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isPass
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : isWarning
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {isPass ? "PASS" : check.severity.toUpperCase()}
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-sm ${
                      isPass
                        ? "text-gray-600 dark:text-gray-400"
                        : isWarning
                        ? "text-amber-700 dark:text-amber-300/80"
                        : "text-red-700 dark:text-red-300/80"
                    }`}
                  >
                    {check.details}
                  </p>

                  {check.failed_items && check.failed_items.length > 0 && (
                    <div className="mt-3 rounded-md bg-white/60 p-3 dark:bg-black/20">
                      <ul className="list-inside list-disc space-y-1 text-xs text-gray-800 dark:text-gray-300">
                        {check.failed_items.map((item, idx) => (
                          <li key={idx} className="break-all font-mono">
                            {typeof item === "string" ? item : JSON.stringify(item)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fileEmojiFromName(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith(".pdf")) return <FileText className="w-4 h-4" />
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return <FileText className="w-4 h-4" />
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return <File className="w-4 h-4" />
  if (lower.endsWith(".txt")) return <FileText className="w-4 h-4" />
  return <File className="w-4 h-4" />
}

function formatSize(size: number) {
  if (!size && size !== 0) return ""
  const mb = size / (1024 * 1024)
  if (mb < 0.01) return `${(size / 1024).toFixed(1)} KB`
  return `${mb.toFixed(1)} MB`
}

export function GenerateScriptPage() {
  const {
    files,
    setFiles,
    handleFileSelect,
  } = useDocumentUpload();

  const { showToast } = useToast();

  const [showAnalysis, setShowAnalysis] = useState(false)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisStatus, setAnalysisStatus] = useState("Waiting for document analysis...")
  const progressPollRef = useRef<number | null>(null)
  const [modules, setModules] = useState<KnowledgeModule[] | null>(null);
  const [selectedScope, setSelectedScope] = useState<string>("all concepts")
  const [generateQuiz, setGenerateQuiz] = useState(true)
  const [useTeacherTemplate, setUseTeacherTemplate] = useState(true)
  const [quizCount, setQuizCount] = useState("6–8")
  const [hintAfter, setHintAfter] = useState("2 times")
  const [generating, setGenerating] = useState(false)
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationSummary | null>(null)
  const [generatedScript, setGeneratedScript] = useState<any | null>(null)
  const [templates, setTemplates] = useState<GameTemplateListItem[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [validating, setValidating] = useState(false)
  const [documentHash, setDocumentHash] = useState<string>("")
  const navigate = useNavigate()
  const [parsedJson, setParsedJson] = useState<any>(null)
  const [parsedJsonReady, setParsedJsonReady] = useState(false)

  useEffect(() => {

    async function loadTemplates() {
    
      try {
        const data = await apiClient.get<Partial<GameTemplateListItem>[]>("/api/game/templates")
        if (Array.isArray(data)) {
        const filteredTemplates = data.map(item => ({
        id: item.id,
        target_level: item.target_level ?? null,
        subject_code: item.subject_code!,
        subject_name: item.subject_name ?? "Unknown Subject",
        name: item.name ?? "Untitled Template",
        }));
        setTemplates(filteredTemplates as GameTemplateListItem[]);
      } else {
        console.warn("Unexpected templates payload (not array):", data)
        setTemplates([])
      }
    } catch (err) {
      console.error("Failed to load script templates", err)
    }
  }

    void loadTemplates()
  }, [])


  useEffect(() => {
    return () => {
      if (progressPollRef.current) {
        window.clearInterval(progressPollRef.current)
      }
    }
  }, [])

  async function fetchAnalysisProgress(hash: string) {
    try {
      const res = await fetch(`/api/game/parsed-documents?hash=${encodeURIComponent(hash)}`)
      if (res.status === 200) {
        const data = await res.json()

        const rawModules = (data as any)?.modules
        const modulesArray = normalizeModules(rawModules)
        const parsedModules = modulesArray.map((item: any, index: number) => ({
          id: `module-${index + 1}`,
          name: item?.name || `Module ${index + 1}`,
          topicCount: item?.topic_count ?? item?.topics?.length ?? 0,
        }))

        if (parsedModules.length > 0) {
          setModules(parsedModules)
          setShowAnalysis(true)
          setHasAnalyzed(true)
        }

        setAnalysisProgress(100)
        setAnalysisStatus("Analysis complete.")
        if (progressPollRef.current) {
          window.clearInterval(progressPollRef.current)
          progressPollRef.current = null
        }
        return
      }

      if (res.status === 202 || res.status === 404) {
        setAnalysisStatus("Waiting for document analysis...")
        setAnalysisProgress(55)
        return
      }

      setAnalysisStatus(`Analysis status unavailable (code ${res.status})`)
    } catch (err) {
      console.warn("Failed to fetch analysis progress", err)
      setAnalysisStatus("Failed to fetch analysis progress")
      if (progressPollRef.current) {
        window.clearInterval(progressPollRef.current)
        progressPollRef.current = null
      }
    }
  }

  // upload the file, kick off analysis, then start polling for progress and chunks
  async function handleAnalyze() {
    if (!files.length || files.length === 0) {
      showToast("Please select at least one file to analyze");
      return;
    }

    setAnalyzing(true);
    setShowAnalysis(true);
    setHasAnalyzed(false);
    setAnalysisProgress(5);
    setAnalysisStatus("Uploading document and starting analysis...");

    const file = files[0];

    const result = await analyzeDocument(file, showToast);

    if (result?.document_hash) {
      const hashToPoll = result.document_hash;
      if (progressPollRef.current) {
        window.clearInterval(progressPollRef.current)
      }
      progressPollRef.current = window.setInterval(() => {
        fetchAnalysisProgress(hashToPoll)
      }, 1500)
    }

    setAnalysisProgress(30);
    setAnalysisStatus("Document analyzed. Parsing modules...");
    setDocumentHash(result?.document_hash || "unknown_hash");

    // if (result) {
    //   const parsedModules = (result.modules || []).map((item: any, index: number) => ({
    //     id: `module-${index + 1}`,
    //     name: item.name || `Module ${index + 1}`,
    //     topicCount: item.topic_count ?? 0,
    //   }));
    if(result){
      const rawModules = result.modules
      const modulesArray = normalizeModules(rawModules)
      if (!Array.isArray(rawModules)) {
        console.warn("Parsed modules normalized from non-array payload:", rawModules)
      }
      const parsedModules = modulesArray.map((item: any, index: number) => ({
        id: `module-${index + 1}`,
        name: item.name || `Module ${index + 1}`,
        topicCount: item.topic_count ?? 0,
      }));

      const newHash = result?.document_hash || "unknown_hash";

      setAnalysisProgress(55);
      setAnalysisStatus("Fetching detailed parse data in the background...");

      getParsedJson(newHash).then(json => {
        setParsedJson(json);
        setParsedJsonReady(true);
        setAnalysisProgress(90);
        setAnalysisStatus("Detailed JSON mapping fetched. Finalizing...");
        console.log("Parsed JSON data fetched in background:", json);
        showToast("Detailed JSON mapping is ready!");
      }).catch(err => {
        setParsedJsonReady(false);
        setAnalysisProgress(0);
        setAnalysisStatus("Failed to load detailed parsed JSON. Please try again.");
        console.error("Failed to parse JSON data:", err);
        showToast("Failed to load detailed parsed JSON. You can retry generate script after a moment.");
      }).finally(() => {
        setAnalysisProgress(100);
        setAnalysisStatus("Analysis completed.");
      });

      setModules(parsedModules);
      setShowAnalysis(parsedModules.length > 0);
      setHasAnalyzed(parsedModules.length > 0);

      if (parsedModules.length === 0) {
        showToast("No knowledge modules were detected in the analyzed document.");
      }

      setAnalysisResult(JSON.stringify(result, null, 2));

    } else {
      setAnalysisResult("Failed to analyze document. Please try again.");
      setAnalysisStatus("Document analysis failed.");
      setAnalysisProgress(0);
    }

    setAnalyzing(false);
  }

  function handleRemove(fileName: string) {
    setFiles((prev) => prev.filter((file) => file.name !== fileName))
    showToast(`Removed ${fileName} from upload queue`)
    setModules(null)
    setShowAnalysis(false)
    setHasAnalyzed(false)
    setAnalysisResult(null)
    setDocumentHash("")
  }

  async function handleGenerateScript() {
    if (!parsedJsonReady) {
      showToast("Detailed document parse is not yet ready. Please wait a moment and try again.");
      return;
    }

    setGenerating(true)
    setAnalysisResult(null) 
    setValidationResult(null)
    setGeneratedScript(null)
    try {
      const response = await fetch("/api/game/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          document_hash: documentHash,
          selectedTemplateId,
          selectedScope,
          chunks: JSON.stringify(parsedJson?.chunks || []),
          concepts: JSON.stringify(parsedJson?.concepts || []),
          relationships: JSON.stringify(parsedJson?.relationships || []),
          concept_chunk_mapping: JSON.stringify(parsedJson?.concept_chunk_mapping || []),
        })
      }).then(res => res.json())

      if (response) {
        setAnalysisResult(JSON.stringify(response, null, 2))
        setGeneratedScript(response)
        showToast("Script generated successfully!")
      } else {
        setAnalysisResult("No data received from the server.")
        showToast("Failed to generate script. Please try again.")
      }
    } catch (err) {
      console.error("Error generating script:", err)
      setAnalysisResult("An error occurred while generating the script. Please try again.")
      showToast("An error occurred while generating the script. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  const handleValidateScript = async () => {
    if (!generatedScript || !generatedScript.script) {
      showToast("No script to validate")
      return
    }

    setValidating(true)
    setAnalysisResult(null)
    setValidationResult(null)
    
    try {
      const response = await fetch("/api/game/validate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(generatedScript.script),
      })

      const data = await response.json()
      
      if (response.ok) {
        if (data.data) {
          setValidationResult(data.data)
        } else {
          setAnalysisResult("Validation completed but no details were returned.")
        }
      } else {
        setAnalysisResult(data.detail || "Failed to validate script.")
        showToast("Failed to validate script.")
      }
    } catch (err) {
      console.error("Error validating script:", err)
      setAnalysisResult("An error occurred while validating the script. Please try again.")
      showToast("An error occurred while validating the script. Please try again.")
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Generate by uploading document
            </h1>
          </div>

          <Button
            variant="secondary"
            onClick={() => {
              navigate("/game/generate-from-base")
            }}
          >
            Generate from knowledge base
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* STEP 1: Choose script template */}
          <div className="md:col-span-2">
            <Card
              title="Step 1: Choose script template"
              subtitle="Templates define the narrative style and difficulty curve for the generated script."
            >
              <div className="space-y-2 text-sm">
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">Auto-select based on subject and difficulty</option>
                  {templates.map(t => {
                    const code = t.subject_code || "GEN";
                    const subjectName = t.subject_name || "Unknown Subject";
                    const templateName = t.name || "Untitled Template";
                    const level = t.target_level ? `Level ${t.target_level}` : "General";
                    return (
                      <option key={t.id} value={t.id}>
                        {code} - {subjectName} : {templateName} - {level} 
                      </option>
                    );
                  })}
             
                </select>
              </div>
            </Card>
          </div>

          {/* Left: upload & analysis */}
          <Card
            title="Step 2: Upload document"
            subtitle="Upload a new file. The system will analyze it and extract knowledge modules."
          >
            <UploadSection
              files={files}
              onFiles={(list) => handleFileSelect(Array.from(list || []))}
              onRemove={handleRemove}
              onAnalyze={handleAnalyze}
              showAnalysis={showAnalysis}
              analyzing={analyzing}
              analysisProgress={analysisProgress}
              analysisStatus={analysisStatus}
            />
          </Card>

          {/* Right: choose knowledge */}
          <Card
            title="Step 3: Choose knowledge you want to learn"
            subtitle={
              hasAnalyzed
                ? "Select scope for this generated learning script."
                : "Analyze the uploaded document first to see available knowledge modules."
            }
          >
            {hasAnalyzed && modules && modules.length > 0 ? (
              <ScopeSelector
                selected={selectedScope}
                onChange={setSelectedScope}
                modules={modules ?? undefined}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                After you upload and analyze a document in Step 2, the key concepts
                detected from that document will appear here for selection.
              </p>
            )}
          </Card>
        </div>

        <div className="mt-4">
          <Card
            title="Step 4: Common settings"
            subtitle="These settings apply to both new uploads and knowledge-base based scripts."
          >
            <SettingsSection
              generateQuiz={generateQuiz}
              onToggleQuiz={setGenerateQuiz}
              useTeacherTemplate={useTeacherTemplate}
              onUseTeacherTemplate={setUseTeacherTemplate}
              quizCount={quizCount}
              onQuizCount={setQuizCount}
              hintAfter={hintAfter}
              onHintAfter={setHintAfter}
              onGenerate={handleGenerateScript}
              generating={generating}
              canGenerate={parsedJsonReady}
              canPlay={Boolean(generatedScript?.scriptId)}
              onPlay={() => {
                if (!generatedScript || !generatedScript.scriptId) return
                
                navigate(`/game/play?scriptId=${generatedScript.scriptId}&documentHash=${documentHash}`, {
                  state: {
                    documentHash,
                    selectedScope,
                    script: generatedScript.script,
                  },
                })
              }}
              onValidate={handleValidateScript}
              validating={validating}
              canValidate={!!generatedScript && !generating && !validating}
            />
          </Card>
        </div>

        {/* Display Analysis Result */}
        <div className="mt-6">
          <Card
            title={validationResult ? "Validation Result" : "Analysis Result"}
            subtitle={validationResult ? "Detailed report on script formatting and rules." : "View the result of the analysis or script generation."}
          >
            {validating ? (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></span>
                Validating script...
              </p>
            ) : validationResult ? (
              <ValidationResultView data={validationResult} />
            ) : analysisResult ? (
              <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-100 p-4 text-sm dark:bg-gray-800 dark:text-gray-200">
                {analysisResult}
              </pre>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No result to display. Generate or validate a script to see the result here.
              </p>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}


type UploadSectionProps = {
  files: File[]
  onFiles: (list: FileList | null) => void
  onRemove: (id: string) => void
  onAnalyze: () => void
  showAnalysis: boolean
  analyzing: boolean
  analysisProgress: number
  analysisStatus: string
}

function UploadSection({ files, onFiles, onRemove, onAnalyze, showAnalysis, analyzing, analysisProgress, analysisStatus }: UploadSectionProps) {
  const [inputId] = useState(() => `file-input-${Math.random().toString(36).slice(2)}`)

  // accept dropped files into the upload list
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFiles(e.dataTransfer.files)
    }
  }

  return (
    <div>
      <div
        className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600 transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:border-indigo-300 dark:hover:bg-gray-900"
        onClick={() => document.getElementById(inputId)?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="mb-2 text-slate-400"><Cloud className="mx-auto h-12 w-12" /></div>
        <div className="font-medium">Drag and drop files here or click to upload</div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Supports PDF, DOC, TXT, etc.</div>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={e => {
            e.stopPropagation()
            document.getElementById(inputId)?.click()
          }}
        >
          Select files
        </Button>
      </div>

      <input
        id={inputId}
        type="file"
        multiple
        className="hidden"
        onChange={e => onFiles(e.target.files)}
      />

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Uploaded files ({files.length})
          </div>
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            {files.map(f => (
              <div
                key={f.name}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-indigo-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-lg dark:bg-gray-800">
                    <span>{fileEmojiFromName(f.name)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900 dark:text-gray-100">{f.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{formatSize(f.size)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(f.name)}
                  className="ml-3 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <Button className="w-full" disabled={!files.length || analyzing} onClick={onAnalyze}>
          {analyzing ? "Analyzing..." : "Analyze document"}
        </Button>
      </div>

      {showAnalysis && (
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Parsing progress</div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <div className="mt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
              {analysisStatus} {analysisProgress < 100 ? `(${analysisProgress}% done)` : "Completed"}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type SettingsSectionProps = {
  generateQuiz: boolean
  onToggleQuiz: (v: boolean) => void
  useTeacherTemplate: boolean
  onUseTeacherTemplate: (v: boolean) => void
  quizCount: string
  onQuizCount: (v: string) => void
  hintAfter: string
  onHintAfter: (v: string) => void
  onGenerate: () => void
  generating: boolean
  canGenerate: boolean
  canPlay: boolean
  onPlay: () => void
  onValidate?: () => void
  validating?: boolean
  canValidate?: boolean
}

function SettingsSection({
  generateQuiz,
  onToggleQuiz,
  useTeacherTemplate,
  onUseTeacherTemplate,
  quizCount,
  onQuizCount,
  hintAfter,
  onHintAfter,
  onGenerate,
  generating,
  canGenerate,
  canPlay,
  onPlay,
  onValidate,
  validating,
  canValidate,
}: SettingsSectionProps) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Generate quiz after learning</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            If enabled, quiz questions will be generated upon script completion.
          </div>
        </div>
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={generateQuiz}
          onChange={e => onToggleQuiz(e.target.checked)}
        />
      </div>
      {generateQuiz && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-100">
            <div>
              <div className="font-medium">Use teacher suggested quiz template?</div>
              <div className="mt-1 text-[11px] text-indigo-800/80 dark:text-indigo-200/80">
                If enabled, quiz count &amp; hint policy will follow the template configured by your teacher.
              </div>
            </div>
            <label className="flex items-center gap-2">
              <span className="text-[11px]">Student custom</span>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={useTeacherTemplate}
                onChange={e => onUseTeacherTemplate(e.target.checked)}
              />
              <span className="text-[11px] font-medium">Teacher template</span>
            </label>
          </div>

          {!useTeacherTemplate && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Number of quiz questions
                </label>
                <select
                  value={quizCount}
                  onChange={e => onQuizCount(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option>4–6</option>
                  <option>6–8</option>
                  <option>8–10</option>
                  <option>10–12</option>
                </select>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  More questions take longer but provide more comprehensive coverage.
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Show hint after how many mistakes
                </label>
                <select
                  value={hintAfter}
                  onChange={e => onHintAfter(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option>1 time</option>
                  <option>2 times</option>
                  <option>3 times</option>
                  <option>Never (Challenge Mode)</option>
                </select>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Hints usually quote original sentences/key points from the document.
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {onValidate && (
          <Button
            variant="secondary"
            type="button"
            disabled={!canValidate}
            onClick={onValidate}
          >
            {validating ? "Validating..." : "Validate script"}
          </Button>
        )}
        <Button
          variant="secondary"
          type="button"
          disabled={!canPlay}
          onClick={onPlay}
        >
          Play Script Kill
        </Button>
        <Button type="button" onClick={onGenerate} disabled={generating || !canGenerate}>
          {generating ? "Generating..." : "Generate script"}
        </Button>
      </div>
    </div>
  )
}


export default GenerateScriptPage
