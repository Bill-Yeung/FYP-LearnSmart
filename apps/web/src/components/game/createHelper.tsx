import { useState } from "react"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { cn } from "../../../../../shared/utils"
import type { KnowledgeModule } from "../../components/form/ScopeSelector"
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";
import { useToast } from "../../contexts/ToastContext"


export type Summary = {
  total_concepts: number
  total_structures: number
  total_applications: number
  difficulty_score: number

}
export type DocumentAnalysisModule = {
    id: string
  name: string
  topic_count?: number
}

export type DocumentAnalysisResult = {
  document_name?: string;
  concept: number;
  structure: number;
  apply: number;
  difficulty_score: number;
  modules?: Array<{
    name: string;
    topic_count?: number;
  }>;
  document_hash?: string;
};

function normalizeModules(rawModules: unknown): Array<{ name?: string; topic_count?: number; topics?: unknown[] }> {
  if (Array.isArray(rawModules)) return rawModules

  if (typeof rawModules === "string") {
    try {
      const parsed = JSON.parse(rawModules)
      return normalizeModules(parsed)
    } catch {
      return []
    }
  }

  if (rawModules && typeof rawModules === "object") {
    const record = rawModules as Record<string, unknown>
    if ("modules" in record) return normalizeModules(record.modules)
    if ("data" in record) return normalizeModules(record.data)
    return Object.values(record).flatMap((value) => normalizeModules(value))
  }

  return []
}

// pull plain text out of pdf, docx, pptx or plain files
async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type || file.name.split(".").pop()?.toLowerCase();

  if (fileType === "pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
    }
    return text;
  } else if (fileType === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } else if (fileType === "pptx") {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slides = zip.folder("ppt/slides");
    let text = "";
    if (slides) {
      for (const filename of Object.keys(slides.files)) {
        const slideContent = await slides.file(filename)?.async("string");
        if (slideContent) {
          text += slideContent;
        }
      }
    }
    return text;
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}

// document analyzer — upload a file and see concept/structure/application counts
export function CreateHelper() {
  const [hash, setHash] = useState<string>("")
  const [analyzerFileName, setAnalyzerFileName] = useState<string | null>(null)
  const [analyzerFile, setAnalyzerFile] = useState<File | null>(null)
  const [analyzerStats, setAnalyzerStats] = useState<{
    concept: number
    structure: number
    apply: number
  } | null>(null)
  const [analyzerModules, setAnalyzerModules] = useState<KnowledgeModule[]>([])
  const [isDocumentExists, setIsDocumentExists] = useState(false) 
  const [existingJson, setExistingJson] = useState<DocumentAnalysisResult | null>(null) 
  const { showToast } = useToast()
  const [skillWeights, setSkillWeights] = useState({
    concept: 1,
    structure: 1,
    apply: 1,
  })
  const [moduleBaseline, setModuleBaseline] = useState({
    concept: 2,
    structure: 2,
    apply: 2,
  })
  const [pointPerLevel, setPointPerLevel] = useState({
    easy: 5,
    medium: 10,
    hard: 15,
  })

  const [autoDifficultyScore, setAutoDifficultyScore] = useState<number | null>(null)
  const [analyzerLoading, setAnalyzerLoading] = useState(false)
  const [analyzerError, setAnalyzerError] = useState<string | null>(null)
  
  // pick a file, read its text and compute a hash for cache lookup
  const handleAnalyzerFile = async (selected: FileList | null) => {
    if (!selected || !selected.length) return;
    const file = selected[0];
    setAnalyzerFile(file);
    setAnalyzerFileName(file.name);
    setAnalyzerStats(null);
    setAnalyzerModules([]);
    setAutoDifficultyScore(null);
    setAnalyzerError(null);
    setIsDocumentExists(false);
    setExistingJson(null);

    try {
      const content = await extractTextFromFile(file);
      const hash = await calculateHash(content);
      setHash(hash);
    } catch (error) {
      console.error("Error processing file:", error);
    }
  };

 // check the cache first, else send the file to the analyzer endpoint
 const analyzeDocument = async () => {
    if (!analyzerFile) {
      setAnalyzerError("No file uploaded. Please upload a file before analyzing.");
      return;
    }
    if (!hash) {
      setAnalyzerError("Failed to calculate document hash. Please try again.");
      return;
    }

    setAnalyzerLoading(true);
    setAnalyzerError(null);

    try {
      const checkResponse = await fetch(`/api/game/parsed-documents?hash=${hash}`);

      if (checkResponse.status === 200) {
        const data = await checkResponse.json();
        setIsDocumentExists(true);
        setExistingJson(data);

        const summary = data.summary;
        setAnalyzerStats({
          concept: summary.total_concepts,
          structure: summary.total_structures,
          apply: summary.total_applications,
        });
        setAnalyzerModules(normalizeModules(data.modules).map((m: any, i: number) => ({
          id: `m${i + 1}`,
          name: m.name,
          topicCount: m.topic_count ?? m.topics?.length ?? 0,
        }))
      );
        setAutoDifficultyScore(summary.difficulty_score);
        setAnalyzerLoading(false);
        return;
      }

      if (checkResponse.status === 202 || checkResponse.status === 404) {
        console.log("No existing analysis found, analyzing now...");
        showToast("Analyzing document...");
      } else {
        console.warn(`Unexpected status ${checkResponse.status}, proceeding with analysis`);
      }
      setIsDocumentExists(false);

      const formData = new FormData();
      formData.append("file", analyzerFile);
      formData.append("hash", hash);
      formData.append("filename", analyzerFileName || "unknown");

      const analyzeResponse = await fetch(`/api/game/analyze-temp`, {
        method: "POST",
        body: formData,
      });

      if (!analyzeResponse.ok) {
        const errorText = await analyzeResponse.text();
        throw new Error(`Analysis failed: ${analyzeResponse.status} - ${errorText}`);
      }

      const data = await analyzeResponse.json();

      setAnalyzerStats({
        concept: data.concept,
        structure: data.structure,
        apply: data.apply,
      });
      setAnalyzerModules(
        normalizeModules(data.modules).map((m: any, i: number) => ({
          id: `m${i + 1}`,
          name: m.name,
          topicCount: m.topic_count ?? 0,
        }))
      );
      setAutoDifficultyScore(data.difficulty_score);
      showToast("Analysis complete!");
    } catch (err) {
      console.error("analyzeDocument error", err);
      setAnalyzerError(
        err instanceof Error ? err.message : "Failed to analyze document. Please try again."
      );
    } finally {
      setAnalyzerLoading(false);
    }
  };


  return (
    <Card>
      <div className="border-b border-gray-100 bg-slate-50 px-4 py-3 dark:border-gray-700 dark:bg-slate-900/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">
          Document analyzer
        </p>
        <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
          Upload a source document to estimate concept / structure / application distribution
          and help tune difficulty settings.
        </p>
      </div>

      <div className="space-y-4 p-4 text-xs">
        <div className="space-y-2">
          <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-200">
            Upload reference document
          </label>
          <input
            type="file"
            className="block w-full cursor-pointer text-[11px] text-slate-600 file:mr-3 file:rounded-md file:border-none file:bg-amber-500 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-amber-600 dark:text-slate-300"
            onChange={(e) => handleAnalyzerFile(e.target.files)}
          />
          {analyzerFileName && (
            <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
              Selected: {analyzerFileName}
            </p>
          )}
          <div className="pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={!analyzerFile || analyzerLoading}
              onClick={analyzeDocument}
            >
              {analyzerLoading ? "Analyzing..." : "Analyze document"}
            </Button>
            {analyzerError && (
              <p className="mt-1 text-[10px] text-red-500 dark:text-red-400">
                {analyzerError}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-100">
            Skill-dimension coverage (AI estimate)
          </p>
          {analyzerStats ? (
            <div className="space-y-1.5">
              {([
                ["Concept", analyzerStats.concept, "bg-sky-500"],
                ["Structure", analyzerStats.structure, "bg-emerald-500"],
                ["Application", analyzerStats.apply, "bg-violet-500"],
              ] as const).map(([label, value, bar]) => (
                <div key={label} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                    <span>{label}</span>
                    <span>{value} pts</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={cn("h-full rounded-full", bar)}
                      style={{ width: `${Math.min(100, value * 5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              No analysis yet. Upload a document to see estimated distribution.
            </p>
          )}
        </div>

        {analyzerModules.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-100">
              Detected modules (AI summary)
            </p>
            <ul className="space-y-1">
              {analyzerModules.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <span className="mr-2 line-clamp-2 flex-1">{m.name}</span>
                  {m.topicCount != null && m.topicCount > 0 && (
                    <span className="ml-2 shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                      {m.topicCount} pts
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2 rounded-md border border-dashed border-slate-200 p-3 dark:border-slate-700">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-100">
            Difficulty weights by skill dimension
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Higher weight means this dimension contributes more to document difficulty.
          </p>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              ["Concept", "concept"],
              ["Structure", "structure"],
              ["Application", "apply"],
            ] as const).map(([label, key]) => (
              <div key={key} className="space-y-1">
                <span className="block text-[11px] text-slate-600 dark:text-slate-200">
                  {label}
                </span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={skillWeights[key as keyof typeof skillWeights]}
                  onChange={(e) =>
                    setSkillWeights((prev) => ({
                      ...prev,
                      [key]: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-100">
            Point allocation & module baselines
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-200">
                Points per difficulty level
              </span>
              {([
                ["Easy", "easy"],
                ["Medium", "medium"],
                ["Hard", "hard"],
              ] as const).map(([label, key]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {label}
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-right text-slate-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={pointPerLevel[key as keyof typeof pointPerLevel]}
                    onChange={(e) =>
                      setPointPerLevel((prev) => ({
                        ...prev,
                        [key]: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-200">
                Module baseline difficulty
              </span>
              {([
                ["Concept", "concept"],
                ["Structure", "structure"],
                ["Application", "apply"],
              ] as const).map(([label, key]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {label}
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-right text-slate-900 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={moduleBaseline[key as keyof typeof moduleBaseline]}
                    onChange={(e) =>
                      setModuleBaseline((prev) => ({
                        ...prev,
                        [key]: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
          <p className="font-semibold">Auto difficulty estimate</p>
          {autoDifficultyScore != null && analyzerStats ? (
            <p>
              Based on current document (C/S/A = {analyzerStats.concept}/
              {analyzerStats.structure}/{analyzerStats.apply}) and weights, overall
              difficulty score is
              <span className="mx-1 inline-flex h-5 items-center rounded-full bg-amber-500 px-2 text-[11px] font-semibold text-white">
                {autoDifficultyScore}
              </span>
              . Use this as a reference when setting easy/medium thresholds.
            </p>
          ) : (
            <p>Upload a document to see an estimated difficulty score.</p>
          )}
        </div>
      </div>
    </Card>
  )
}

export async function calculateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export { extractTextFromFile };

// shared helper: read file, hash it, and ask the server for analysis
export async function analyzeDocument(file: File, showToast: (message: string) => void): Promise<DocumentAnalysisResult | null> {
  try {
    const content = await extractTextFromFile(file);
    const hash = await calculateHash(content);

    const checkResponse = await fetch(`/api/game/parsed-documents?hash=${hash}`);

    if (checkResponse.status === 200) {
      const data = await checkResponse.json();
      return data;
    }

    if (checkResponse.status === 202 || checkResponse.status === 404) {
      showToast("Analyzing document...");
    } else {
      console.warn(`Unexpected status ${checkResponse.status}, proceeding with analysis`);
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("hash", hash);
    formData.append("filename", file.name);

    const analyzeResponse = await fetch(`/api/game/analyze-temp`, {
      method: "POST",
      body: formData,
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      throw new Error(`Analysis failed: ${analyzeResponse.status} - ${errorText}`);
    }

    const analyzeData = await analyzeResponse.json();

    // Check once if it's already fully in DB
    const finalCheck = await fetch(`/api/game/parsed-documents?hash=${hash}`);
    if (finalCheck.status === 200) {
      return await finalCheck.json();
    }

    // If it's pending (202) or anything else, just return the analyzeResponse data array
    // Our UI component will use document_hash to poll fetchAnalysisProgress if needed
    return analyzeData;
  } catch (error) {
    console.error("Error analyzing document:", error);
    return null;
  }
}
