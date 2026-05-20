import { useState } from "react";
import { Button } from "..";
import { apiClient } from "../../lib/api";
import { useToast } from "../../contexts";

interface AutoTagResult {
  tagged_count: number;
  skipped_count: number;
  message: string;
  sample_tags: Record<string, string[]>;
}

interface FlashcardAutoTaggerProps {
  onComplete?: (result: AutoTagResult) => void;
  limit?: number;
  overwrite?: boolean;
}

export const FlashcardAutoTagger: React.FC<FlashcardAutoTaggerProps> = ({
  onComplete,
  limit = 50,
  overwrite = false,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutoTagResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ask the server to auto-generate tags for untagged flashcards
  const handleAutoTag = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.post<AutoTagResult>(
        "/flashcards/auto-tag",
        {
          limit,
          overwrite,
        }
      );

      if (response) {
        setResult(response);
        showToast(`Successfully auto-tagged ${response.tagged_count} flashcards!`);
        onComplete?.(response);
      }
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to auto-tag flashcards";
      setError(errorMessage);
      showToast(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Auto-Tag Flashcards
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Use AI to automatically generate meaningful tags for your flashcards. Tags help organize and filter your study materials.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <h4 className="font-semibold text-green-900 dark:text-green-100">
              ✓ Tagging Complete
            </h4>
            <div className="mt-2 space-y-1 text-sm text-green-800 dark:text-green-200">
              <p>Tagged: {result.tagged_count} flashcards</p>
              {result.skipped_count > 0 && <p>Skipped: {result.skipped_count} flashcards</p>}
              <p className="mt-2">{result.message}</p>
            </div>
          </div>

          {Object.keys(result.sample_tags).length > 0 && (
            <div className="bg-gray-50 p-4 dark:bg-gray-900/50">
              <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Sample Tags Generated:
              </h4>
              <div className="space-y-2">
                {Object.entries(result.sample_tags).map(([cardId, tags]) => (
                  <div key={cardId} className="text-xs">
                    <p className="mb-1 text-gray-600 dark:text-gray-400">Card {cardId.slice(0, 8)}...</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block rounded-full bg-indigo-100 px-2 py-1 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="secondary" onClick={handleReset} className="w-full">
            Dismiss
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>
              This will scan your flashcards without tags and generate meaningful ones automatically.
            </p>
            <p>
              Process up to <strong>{limit}</strong> flashcards.
            </p>
            <p>
              {overwrite ? (
                <>Will regenerate tags for all flashcards (including those already tagged).</>
              ) : (
                <>Will skip flashcards that already have tags.</>
              )}
            </p>
          </div>

          <Button
            onClick={handleAutoTag}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? "Auto-Tagging in progress..." : "Start Auto-Tagging"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default FlashcardAutoTagger;
