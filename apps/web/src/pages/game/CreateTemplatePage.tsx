import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { cn } from "../../../../../shared/utils"

import {
  createTemplate as apiCreateTemplate,
  updateTemplate,
  listSubjects,
  getTemplate,
  type SubjectOption,
} from "../../api/gameTemplates"

function useQuery() {
  return new URLSearchParams(useLocation().search)
}

import type {
  TargetLevel,
  ContentSource,
  QuizCountOption,
  PassScoreOption,
  QuizSourceOption,
  QuizMode,
  ManualQuizConfig,
  TemplatePayload,
} from "../../../../../shared/types"

import type { GameTemplateResponse } from "../../api/gameTemplates"

import {
  BasicInfoSection,
  ContentInfoSection,
  DifficultySection,
  QuizConfigurationSection,
} from "../../components/game/createSection"

import { CreateHelper } from "../../components/game/createHelper"

export function CreateTemplatePage() {
  const query = useQuery()
  const editId = query.get("id")

  
  const [templateName, setTemplateName] = useState("")
  const [targetLevel, setTargetLevel] = useState<TargetLevel>("standard")
  const [description, setDescription] = useState("")

  
  const [contentSource, setContentSource] = useState<ContentSource>("system")
  const [subjectName, setSubjectName] = useState<string>("")
  const [subjectCode, setSubjectCode] = useState<string>("")
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([])

  
  const [puzzleMcq, setPuzzleMcq] = useState(3)
  const [puzzleSorting, setPuzzleSorting] = useState(1)
  const [puzzleFill, setPuzzleFill] = useState(1)

  
  const [enableQuiz, setEnableQuiz] = useState(true)
  const [quizCount, setQuizCount] = useState<QuizCountOption>("6-8")
  const [passScore, setPassScore] = useState<PassScoreOption>(80)
  const [quizSource, setQuizSource] = useState<QuizSourceOption>("doc_ai")
  const [quizMode, setQuizMode] = useState<QuizMode>("manual") 
  const [manualQuizConfig, setManualQuizConfig] = useState<ManualQuizConfig>({
    mcq: 8,
    fill: 2,
    code: 0,
    sort: 2,
    short: 0,
  })

  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [templateNameError, setTemplateNameError] = useState<string | null>(null)
  const [createdTemplate, setCreatedTemplate] = useState<GameTemplateResponse | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await listSubjects()
        setSubjectOptions(data)
      } catch {}
    })()
  }, [])

  // when editing an existing template: load it and hydrate every form field
  useEffect(() => {
    if (!editId) return
    ;(async () => {
      try {
        const tpl = await getTemplate(editId)
        
        setTemplateName(tpl.basic?.name || "")
        setTargetLevel(tpl.basic?.target_level || "standard")
        setDescription(tpl.basic?.description || "")
        setContentSource(tpl.content?.source || "system")
        setSubjectCode(tpl.content?.subject_code || "")
        setSubjectName(tpl.content?.subject_name || "")
        setPuzzleMcq(tpl.difficulty?.puzzle_mcq ?? 3)
        setPuzzleSorting(tpl.difficulty?.puzzle_sorting ?? 1)
        setPuzzleFill(tpl.difficulty?.puzzle_fill ?? 1)
        setEnableQuiz(tpl.quiz?.enabled ?? true)
        if (tpl.quiz && tpl.quiz.enabled) {
          setQuizCount(tpl.quiz.count_range || "6-8")
          setPassScore(tpl.quiz.pass_score ?? 80)
          setQuizSource(tpl.quiz.source || "doc_ai")
          setQuizMode(tpl.quiz.mode || "manual")
          setManualQuizConfig(tpl.quiz.manual_config || { mcq: 8, fill: 2, code: 0, sort: 2, short: 0 })
        } else {
          setQuizCount("6-8")
          setPassScore(80)
          setQuizSource("doc_ai")
          setQuizMode("manual")
          setManualQuizConfig({ mcq: 8, fill: 2, code: 0, sort: 2, short: 0 })
        }
      } catch (e) {
        
        console.error("Failed to load template for edit", e)
      }
    })()
  }, [editId])

  function buildPayload(status: TemplatePayload["status"]): TemplatePayload {
    return {
      status,
      basic: {
        name: templateName,
        target_level: targetLevel,
        description,
      },
      content: {
        source: contentSource,
        subject_code: subjectCode || null,
        subject_name: subjectName || null,
      },
      difficulty: {
        puzzle_mcq: puzzleMcq,
        puzzle_sorting: puzzleSorting,
        puzzle_fill: puzzleFill,
      },
      quiz: enableQuiz
        ? {
            enabled: true,
            count_range: quizCount,
            pass_score: passScore,
            source: quizSource,
            mode: quizMode,
            manual_config: quizMode === "manual" ? manualQuizConfig : null,
          }
        : { enabled: false },
    }
  }

  async function submitTemplate(status: TemplatePayload["status"]) {
    if (!templateName.trim()) {
      setTemplateNameError("Template name is required.")
      setErrorMessage("Template name is required.")
      setSuccessMessage(null)
      return
    }

    const payload = buildPayload(status)
    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const data = await apiCreateTemplate(payload)
      setCreatedTemplate(data)
      setSuccessMessage(
        data.status === "published"
          ? `Template v${data.version} published successfully.`
          : `Template v${data.version} saved as draft successfully.`
      )
    } catch (err) {
      
      console.error("Failed to create template", err)
      setErrorMessage(err instanceof Error ? err.message : "Failed to create template")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveDraft() {
    if (!templateName.trim()) {
      setTemplateNameError("Template name is required.")
      setErrorMessage("Template name is required.")
      setSuccessMessage(null)
      return
    }
    const payload = buildPayload("draft")
    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      let data: any
      if (isEdit && editId) {
        data = await updateTemplate(editId, payload)
        setSuccessMessage(`Template v${data.version} updated successfully.`)
      } else {
        data = await apiCreateTemplate(payload)
        setSuccessMessage(
          data.status === "published"
            ? `Template v${data.version} published successfully.`
            : `Template v${data.version} saved as draft successfully.`
        )
      }
      setCreatedTemplate(data)
    } catch (err) {
      
      console.error("Failed to save template", err)
      setErrorMessage(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePublish() {
    await submitTemplate("published")
  }

  function handleManualQuizChange<K extends keyof ManualQuizConfig>(key: K, value: number) {
    setManualQuizConfig((prev) => ({ ...prev, [key]: value }))
  }

  
  const isEdit = !!editId

  return (
    <div className="mx-auto max-w-6xl">
      {}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create Script Template
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/game"
            className={cn(
              "inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            )}
          >
            Home
          </Link>
          <Link
            to="/game/personal-management"
            className={cn(
              "inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            )}
          >
            Personal Management
          </Link>
          <Link
            to="/game/my-templates"
            className={cn(
              "inline-flex items-center rounded-lg border border-amber-300 bg-amber-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
            )}
          >
            Overview Templates
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
        {}
        <Card>
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-amber-50 px-4 py-3 dark:border-gray-700 dark:bg-amber-950/30">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-300">
                Template config
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-200/80">
                Define rules for scripts & quizzes generated from this template.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              {createdTemplate
                ? `v${createdTemplate.version} · ${createdTemplate.status}`
                : "v1 · draft"}
            </span>
          </div>

          <div className="space-y-5 p-4">
            <BasicInfoSection
              templateName={templateName}
              templateNameError={templateNameError}
              setTemplateName={(value) => {
                setTemplateName(value)
                if (templateNameError && value.trim()) {
                  setTemplateNameError(null)
                }
              }}
              targetLevel={targetLevel}
              setTargetLevel={setTargetLevel}
              description={description}
              setDescription={setDescription}
            />

            <ContentInfoSection
              contentSource={contentSource}
              setContentSource={setContentSource}
              subjectOptions={subjectOptions}
              subjectName={subjectName}
              setSubjectName={setSubjectName}
              subjectCode={subjectCode}
              setSubjectCode={setSubjectCode}
            />

            <DifficultySection
              puzzleMcq={puzzleMcq}
              setPuzzleMcq={setPuzzleMcq}
              puzzleSorting={puzzleSorting}
              setPuzzleSorting={setPuzzleSorting}
              puzzleFill={puzzleFill}
              setPuzzleFill={setPuzzleFill}
            />

            <QuizConfigurationSection
              enableQuiz={enableQuiz}
              setEnableQuiz={setEnableQuiz}
              quizCount={quizCount}
              setQuizCount={setQuizCount}
              passScore={passScore}
              setPassScore={setPassScore}
              quizSource={quizSource}
              setQuizSource={setQuizSource}
              quizMode={quizMode}
              setQuizMode={setQuizMode}
              manualQuizConfig={manualQuizConfig}
              handleManualQuizChange={handleManualQuizChange}
            />

            {}
            <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              {successMessage && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {successMessage}
                </div>
              )}
              {errorMessage && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMessage}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-3 pt-1">
                {isEdit ? (
                  <Button variant="primary" onClick={handleSaveDraft} disabled={isSubmitting}>
                    Save Changes
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={handleSaveDraft} disabled={isSubmitting}>
                      Save Draft
                    </Button>
                    <Button variant="primary" onClick={handlePublish} disabled={isSubmitting}>
                      Publish Template
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        {}
        <CreateHelper />
      </div>
    </div>
  )
}
