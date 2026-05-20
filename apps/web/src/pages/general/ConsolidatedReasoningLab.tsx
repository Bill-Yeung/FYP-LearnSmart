import React, { useMemo, useState } from "react"
import { Card, Button } from "../../components"
import { CONCEPTS, SIMPLIFIED_EXAMPLES, CHECK_UNDERSTANDING_EXAMPLES, SAMPLE_EXPLANATIONS } from "../../configs/sampleData"

type Analysis = {
  missing_terms: string[]
  logical_gaps: string[]
  unclear_reasoning: string[]
  revised_explanation: string | null
  summary: string | null
  score: number | null
}

export function ConsolidatedReasoningLab() {
  const [conceptId, setConceptId] = useState("")
  const [explanation, setExplanation] = useState("")
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [simplified, setSimplified] = useState<string | null>(null)
  const [reflections, setReflections] = useState<any[]>(() => {
    try {
      const r = localStorage.getItem("consolidated_reflections")
      return r ? JSON.parse(r) : []
    } catch {
      return []
    }
  })
  const [checkResults, setCheckResults] = useState<any | null>(null)

  const concepts = useMemo(() => CONCEPTS, [])

  // demo analyzer that just checks how many keywords from the concept appear in the user's explanation
  function localAnalyze(conceptIdLocal: string, expl: string): Analysis {
    const concept = CONCEPTS.find(c => c.id === conceptIdLocal)
    const keywords = concept?.keywords ?? []
    const normalize = (s = "") => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ")
    const words = new Set(normalize(expl).split(/\s+/).filter(Boolean))
    const missing = keywords.filter(k => !words.has(k.toLowerCase()))
    const logical = missing.length ? ["Missing key steps or links between concepts"] : []
    const unclear = /maybe|i think|not sure|sort of|kind of/i.test(expl) ? ["Uncertain phrasing"] : []
    const score = Math.round(((keywords.length - missing.length) / (keywords.length || 1)) * 100)
    const revised = expl + (missing.length ? `\n\nInclude: ${missing.join(", ")}` : "")
    return {
      missing_terms: missing,
      logical_gaps: logical,
      unclear_reasoning: unclear,
      revised_explanation: revised,
      summary: `Local demo: ${score}% of key terms present`,
      score
    }
  }

  // run the local fake-AI analysis and stash the result for the right pane
  function handleAnalyze() {
    if (!conceptId) return alert("请选择概念")
    if (!explanation.trim()) return alert("请输入解释内容")
    const res = localAnalyze(conceptId, explanation)
    setAnalysis(res)
  }

  function handleSimplify() {
    if (!conceptId) return alert("请选择概念")
    const sim = SIMPLIFIED_EXAMPLES[conceptId] ?? "(无法简化，示例数据缺失)"
    setSimplified(sim)
  }

  // save the current concept + explanation as a reflection entry into localStorage
  function handleReflect() {
    if (!conceptId) return alert("请选择概念")
    if (!explanation.trim()) return alert("请先输入你的教学/解释文本")
    const item = { conceptId, explanation, timestamp: Date.now(), by: "demo" }
    const next = [item, ...reflections]
    setReflections(next)
    localStorage.setItem("consolidated_reflections", JSON.stringify(next))
    alert("已保存反思")
  }

  // look up the demo "check understanding" response for the chosen concept
  function handleCheckUnderstanding() {
    if (!conceptId) return alert("请选择概念")
    const found = CHECK_UNDERSTANDING_EXAMPLES.find(c => c.conceptId === conceptId)
    setCheckResults(found ?? { flagged: [] })
  }

  // drop a canned sample explanation into the textarea so users can try things quickly
  function loadSample() {
    const s = SAMPLE_EXPLANATIONS.find(s => s.conceptId === conceptId)
    if (s) setExplanation(s.explanation)
    else alert("没有示例解释可用")
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Card title="Consolidated Reasoning Lab" subtitle={`This module integrates explanation, error correction, simplification, and reflection into a continuous AI dialogue flow.`}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">选择概念</label>
                <select className="w-full rounded border px-2 py-2 mt-1" value={conceptId} onChange={e => setConceptId(e.target.value)}>
                  <option value="">-- 选择 --</option>
                  {concepts.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">你的解释（文本）</label>
                <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={6} className="w-full rounded border px-2 py-2 mt-1" placeholder="在此输入你的解释或教案" />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAnalyze}>运行 AI 分析（本地 demo）</Button>
                <Button variant="secondary" onClick={handleSimplify}>简化解释</Button>
                <Button variant="ghost" onClick={handleReflect}>保存反思</Button>
                <Button variant="ghost" onClick={handleCheckUnderstanding}>检查理解</Button>
                <Button variant="outline" onClick={loadSample}>加载示例解释</Button>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-800 dark:text-gray-200">
              <div className="rounded-lg border p-3 bg-gray-50 dark:bg-gray-900">
                <div className="font-semibold text-xs uppercase tracking-wide">AI 分析（示例）</div>
                {analysis ? (
                  <div className="mt-2 text-xs">
                    <div className="font-semibold">Missing terms</div>
                    <div>{analysis.missing_terms.length ? analysis.missing_terms.join(", ") : "None"}</div>
                    <div className="mt-2 font-semibold">Logical gaps</div>
                    <div>{analysis.logical_gaps.join(", ") || "None"}</div>
                    <div className="mt-2 font-semibold">Unclear reasoning</div>
                    <div>{analysis.unclear_reasoning.join(", ") || "None"}</div>
                    <div className="mt-2 font-semibold">Rewritten</div>
                    <div className="whitespace-pre-wrap">{analysis.revised_explanation}</div>
                    <div className="mt-2 text-xs text-gray-500">{analysis.summary}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-500">在左侧输入并运行 AI 分析以查看反馈。</div>
                )}
              </div>

              <div className="rounded-lg border p-3 bg-white dark:bg-gray-950">
                <div className="font-semibold text-xs uppercase tracking-wide">简化版本</div>
                <div className="mt-2 text-sm">{simplified ?? "点击 '简化解释' 生成简化版本"}</div>
              </div>

              <div className="rounded-lg border p-3 bg-gray-50 dark:bg-gray-900">
                <div className="font-semibold text-xs uppercase tracking-wide">检查理解结果</div>
                {checkResults ? (
                  <div className="mt-2 text-xs">
                    {(checkResults.flagged.length ? checkResults.flagged : []).map((f: any, i: number) => (
                      <div key={i} className="mb-2"><strong>{f.text}</strong><div className="text-xs text-gray-500">原因: {f.reason}</div></div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-500">点击 '检查理解' 查看示例标注结果。</div>
                )}
              </div>

              <div className="rounded-lg border p-3 bg-white dark:bg-gray-950">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs uppercase tracking-wide">已保存反思</div>
                  <div className="text-xs text-gray-500">{reflections.length} 条</div>
                </div>
                <div className="mt-2 text-xs">
                  {reflections.length === 0 ? (
                    <div className="text-gray-500">暂无反思，点击 '保存反思' 添加。</div>
                  ) : (
                    reflections.map((r, i) => (
                      <div key={i} className="mb-2 text-xs border-t pt-2"><div className="font-semibold">{CONCEPTS.find(c=>c.id===r.conceptId)?.title ?? r.conceptId}</div><div className="text-gray-600">{r.explanation}</div><div className="text-gray-400 text-[11px] mt-1">{new Date(r.timestamp).toLocaleString()}</div></div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}

export default ConsolidatedReasoningLab
