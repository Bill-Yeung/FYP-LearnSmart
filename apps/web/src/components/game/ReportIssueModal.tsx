import React, { useState } from "react"
import { Button } from "../index"
import TextAreaField from "../form/TextAreaField"

export interface ReportIssueModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (issueType: string, customComment: string) => void
  isSubmitting?: boolean
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false
}) => {
  const [issueType, setIssueType] = useState('bug')
  const [comment, setComment] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(issueType, comment)
  }

  return (
    <div className="fixed inset-0 bg-transparent backdrop-blur-sm bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 p-6 animate-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Report Issue & Skip</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          If you believe this question is incorrect, ambiguous, or the system failed to accept a valid answer, please report it below. We'll skip it for now and fix it soon!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issue Type</label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="wrong_answer">My answer is correct, but system rejected it</option>
              <option value="ambiguous">Question is ambiguous or confusing</option>
              <option value="bug">Technical bug or glitch</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <TextAreaField
              label="Additional Comments (Optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What specifically seems wrong?"
              minRows={3}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-700 text-white border-transparent">
              {isSubmitting ? 'Reporting...' : 'Report & Skip'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
