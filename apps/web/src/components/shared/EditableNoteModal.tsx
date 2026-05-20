import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import RichTextEditor from '../flashcards/RichTextEditor';

interface EditableNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialContent?: string | null;
  onSave: (newContent: string) => Promise<void>;
  isSaving?: boolean;
}

export function EditableNoteModal({
  isOpen,
  onClose,
  title,
  initialContent,
  onSave,
  isSaving = false,
}: EditableNoteModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent || '');
  const [internalIsSaving, setInternalIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent || '');
      setIsEditing(false);
      setInternalIsSaving(false);
    }
  }, [isOpen, initialContent]);

  const handleSave = async () => {
    setInternalIsSaving(true);
    await onSave(content.trim());
    setInternalIsSaving(false);
    setIsEditing(false);
  };

  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear and delete this note?')) {
      setInternalIsSaving(true);
      setContent('');
      await onSave('');
      setInternalIsSaving(false);
      setIsEditing(false);
      onClose();
    }
  };

  const currentIsSaving = isSaving || internalIsSaving;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="flex flex-col h-full max-h-[calc(100vh-250px)]">
        <div className="flex-1 overflow-y-auto py-2">
        {isEditing ? (
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Write your note down here..."
            minHeight="240px"
            dataTestId="editable-note-modal-editor"
          />
        ) : (
          <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 px-1">
            {content ? (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
            ) : (
              <p className="italic text-gray-400">No note written yet.</p>
            )}
          </div>
        )}
        </div>

      <div className="flex-none z-10 mt-4 pt-4 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-row justify-between items-center">
          <div>
            {!isEditing && content ? (
              <Button
                variant="secondary"
                onClick={handleClear}
                disabled={currentIsSaving}
                className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={currentIsSaving}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={currentIsSaving}>
                  {currentIsSaving ? 'Saving...' : 'Save Note'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={() => setIsEditing(true)}>
                  {content ? 'Edit Note' : 'Add Note'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </Modal>
  );
}
