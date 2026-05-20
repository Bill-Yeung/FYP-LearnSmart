import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FileText, Cpu, CheckSquare } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts';

type ExtractedQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  options?: string[];
  suggested_answer?: string;
};

const DIFFICULTY_MAP: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };
const TYPE_MAP: Record<string, string> = { mcq: 'mcq', MCQ: 'mcq', tf: 'tf', 'True/False': 'tf', short: 'short', Short: 'short', essay: 'short', Essay: 'short', fill: 'fill' };

export default function TeacherPastPaperImportPage() {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'review'>('idle');
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Record<string, Partial<ExtractedQuestion>>>({});
  const [saving, setSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('processing');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.upload<{ message: string; questions: ExtractedQuestion[] }>('/api/teacher/papers/extract', formData);
      setQuestions(res?.questions ?? []);
      setRejected(new Set());
      setEdited({});
      setStatus('review');
    } catch (e) {
      console.error(e);
      showToast('Extraction failed', 'error');
      setStatus('idle');
    }
  };

  const saveToBank = async (qs: ExtractedQuestion[]) => {
    setSaving(true);
    let saved = 0;
    for (const q of qs) {
      const merged = { ...q, ...edited[q.id] };
      try {
        await apiClient.post('/api/teacher/question-bank', {
          question_text: merged.question_text,
          question_type: TYPE_MAP[merged.question_type] ?? 'short',
          difficulty: DIFFICULTY_MAP[merged.difficulty] ?? 2,
          correct_answer: merged.suggested_answer ?? '',
          options: merged.options ?? [],
          skill_dim: 'concept',
          score_max: 1,
        });
        saved++;
      } catch {
        showToast(`Failed to save: ${merged.question_text.slice(0, 40)}…`, 'error');
      }
    }
    setSaving(false);
    if (saved > 0) {
      showToast(`${saved} question${saved > 1 ? 's' : ''} saved to Question Bank`, 'success');
      setStatus('idle');
      setFile(null);
    }
  };

  const approveAll = () => {
    const toSave = questions.filter(q => !rejected.has(q.id));
    saveToBank(toSave);
  };

  const approveSingle = (q: ExtractedQuestion) => saveToBank([q]);

  const reject = (id: string) => setRejected(prev => new Set([...prev, id]));

  const updateField = (id: string, field: keyof ExtractedQuestion, value: string) =>
    setEdited(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const active = questions.filter(q => !rejected.has(q.id));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Past Paper Import (AI)</h1>
        <p className="text-gray-500">Upload PDF or Word documents of past exams to automatically extract and categorise questions.</p>
      </div>

      {status === 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>Supports .pdf, .doc, .docx — AI will extract and categorise all questions</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-10">
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-medium mb-2">Select a file to upload</h3>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
              Our AI will read the document, identify individual questions, extract multiple choice options, and suggest correct answers if a marking scheme is included.
            </p>
            <div className="mb-6">
              <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" className="border p-2 rounded-md" />
            </div>
            <Button onClick={handleUpload} disabled={!file}>Upload & Extract</Button>
          </CardContent>
        </Card>
      )}

      {status === 'processing' && (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <Cpu className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
            <h3 className="text-xl font-medium mb-2">AI is processing your document...</h3>
            <p className="text-gray-500 mb-6">Extracting questions, identifying types, and tagging topics.</p>
            <div className="w-full max-w-md bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{ width: '65%' }} />
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'review' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-green-500" />
              Review Extracted Questions ({active.length} of {questions.length} to approve)
            </h3>
            <div className="space-x-2">
              <Button variant="secondary" onClick={() => setStatus('idle')} disabled={saving}>Discard All</Button>
              <Button onClick={approveAll} disabled={saving || active.length === 0}>
                {saving ? 'Saving…' : `Approve All (${active.length}) to Question Bank`}
              </Button>
            </div>
          </div>

          {questions.map((q) => {
            const isRejected = rejected.has(q.id);
            const merge = { ...q, ...edited[q.id] };
            return (
              <Card key={q.id} className={isRejected ? 'opacity-40' : ''}>
                <CardContent className="p-4 flex gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">{merge.question_type}</span>
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Difficulty: {merge.difficulty}</span>
                    </div>

                    {edited[q.id]?.question_text !== undefined ? (
                      <textarea
                        className="w-full border rounded p-1.5 text-sm"
                        rows={2}
                        value={edited[q.id]?.question_text ?? q.question_text}
                        onChange={e => updateField(q.id, 'question_text', e.target.value)}
                      />
                    ) : (
                      <p className="font-medium">{q.question_text}</p>
                    )}

                    {merge.options && merge.options.length > 0 && (
                      <ul className="text-sm space-y-1 pl-4 list-disc">
                        {merge.options.map((opt, i) => (
                          <li key={i} className={opt === merge.suggested_answer ? 'text-green-600 font-medium' : ''}>
                            {opt} {opt === merge.suggested_answer && '(Suggested Answer)'}
                          </li>
                        ))}
                      </ul>
                    )}

                    {merge.suggested_answer && (!merge.options || merge.options.length === 0) && (
                      <div className="text-sm bg-gray-50 p-2 rounded text-gray-700">
                        <strong>Suggested Answer:</strong> {merge.suggested_answer}
                      </div>
                    )}
                  </div>

                  {!isRejected && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button onClick={() => approveSingle(q)} disabled={saving}>Approve</Button>
                      <Button variant="secondary" onClick={() => updateField(q.id, 'question_text', edited[q.id]?.question_text ?? q.question_text)}>
                        Edit
                      </Button>
                      <Button variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => reject(q.id)}>Reject</Button>
                    </div>
                  )}
                  {isRejected && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button variant="secondary" onClick={() => setRejected(prev => { const s = new Set(prev); s.delete(q.id); return s; })}>Restore</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
