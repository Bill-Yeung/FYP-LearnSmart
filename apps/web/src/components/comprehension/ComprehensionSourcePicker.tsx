import type { ComprehensionSubject, ComprehensionWorkspace } from "../../hooks/useComprehensionWorkspace"

type Props = {
  workspace: ComprehensionWorkspace
  onUseConcept?: (concept: string) => void
}

function subjectLabel(subject: ComprehensionSubject) {
  return subject.code ? `${subject.code} - ${subject.name}` : subject.name
}

export function ComprehensionSourcePicker({ workspace, onUseConcept }: Props) {
  return (
    <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Linked study context</p>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Optionally attach a subject or completed document so each generation stays grounded in your saved materials.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs text-gray-600 dark:text-gray-400">Subject</span>
          <select
            value={workspace.selectedSubjectId}
            onChange={(event) => workspace.setSelectedSubjectId(event.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
          >
            <option value="">All subjects</option>
            {workspace.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subjectLabel(subject)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-gray-600 dark:text-gray-400">Document</span>
          <select
            value={workspace.selectedDocumentId}
            onChange={(event) => workspace.setSelectedDocumentId(event.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
          >
            <option value="">No linked document</option>
            {workspace.documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.document_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {workspace.loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading subjects and documents...</p>
      )}

      {!workspace.loading && workspace.selectedDocument && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/40">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Selected document</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {workspace.selectedDocument.document_name}
          </p>

          {workspace.documentConceptLabels.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Detected concepts</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {workspace.documentConceptLabels.map((concept) => (
                  <button
                    key={concept}
                    type="button"
                    onClick={() => onUseConcept?.(concept)}
                    className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {concept}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
