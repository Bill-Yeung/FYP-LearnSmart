import { useState, useEffect, useCallback } from 'react';
import { logActivity } from '../lib/activityLog';
import { dispatchErrorBookChanged } from '../lib/errorBookEvents';

export interface ScheduledErrorItem {
  id: string;
  question: string;
  wrongAnswer: string;
  correctAnswer: string;
  explanation: string;
  reflectionNotes: string;
  categoryLabel: string;
  lastErrorDate: string;
  nextReviewDate: string | null;
  interval: number;
  status: 'due' | 'scheduled' | 'mastered';
  topic?: string;
  sourceExam?: string;
}

export interface UseScheduleErrorReviewResult {
  items: ScheduledErrorItem[];
  dueItems: ScheduledErrorItem[];
  upcomingItems: ScheduledErrorItem[];
  masteredItems: ScheduledErrorItem[];
  loading: boolean;
  error: string | null;
  markReviewed: (id: string, success: boolean, algorithm?: string) => Promise<void>;
  rescheduleItem: (id: string, newIntervalDays: number) => Promise<void>;
  refresh: () => Promise<void>;
}

// shape a server error row into the item the ui uses, working out its review status
function toItem(r: Record<string, unknown>): ScheduledErrorItem {
  const nextReviewRaw = r.next_review_time as string | null;
  const nextReviewDate = nextReviewRaw
    ? new Date(nextReviewRaw).toISOString().slice(0, 10)
    : null;
  const firstWrong = r.first_wrong_time
    ? new Date(r.first_wrong_time as string).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const isMastered = Boolean(r.is_mastered);

  const status: ScheduledErrorItem['status'] = isMastered
    ? 'mastered'
    : !nextReviewDate || nextReviewDate <= today
    ? 'due'
    : 'scheduled';

  const questionStem = r.question_stem as string | null;
  const wrongAnswer = r.wrong_answer as string | null;
  const question =
    (questionStem && questionStem.trim()) ||
    (wrongAnswer && wrongAnswer.trim()) ||
    'Unknown question';

  return {
    id: r.id as string,
    question,
    wrongAnswer: (r.wrong_answer as string | null) || '',
    correctAnswer: (r.correct_answer_snapshot as string | null) || '',
    explanation: (r.system_explanation as string | null) || '',
    reflectionNotes: (r.user_reflection_notes as string | null) || '',
    categoryLabel: (r.category_label as string | null) || '',
    lastErrorDate: firstWrong,
    nextReviewDate,
    interval: nextReviewDate
      ? Math.max(0, Math.round((new Date(nextReviewDate).getTime() - new Date(today).getTime()) / 86400000))
      : 0,
    status,
    topic: (r.topic as string | null) || undefined,
    sourceExam: (r.source_exam as string | null) || undefined,
  };
}

export function useScheduleErrorReview(): UseScheduleErrorReviewResult {
  const [items, setItems] = useState<ScheduledErrorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/error-book?filter=all&limit=200', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load errors (${res.status})`);
      const data = await res.json() as { errors: Record<string, unknown>[] };
      setItems((data.errors ?? []).map(toItem));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load errors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const dueItems = items.filter(i => i.status === 'due');
  const upcomingItems = items
    .filter(i => i.status === 'scheduled')
    .sort((a, b) =>
      (a.nextReviewDate ?? '').localeCompare(b.nextReviewDate ?? ''),
    );
  const masteredItems = items.filter(i => i.status === 'mastered');

  // optimistically mark the error as reviewed, then sync with the server's new schedule
  async function markReviewed(id: string, success: boolean, algorithm: string = 'simple') {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, status: 'scheduled' as const } : item,
      ),
    );
    try {
      const res = await fetch('/api/error-book/schedule-review', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_id: id,
          algorithm,
          rating: success ? 3 : 1,
        }),
      });
      if (!res.ok) {
        await fetchAll();
      } else {
        const data = await res.json() as { next_review_time: string };
        const nextDate = new Date(data.next_review_time).toISOString().slice(0, 10)
        const todayStr = new Date().toISOString().slice(0, 10)
        const daysUntil = Math.max(0, Math.round((new Date(nextDate).getTime() - new Date(todayStr).getTime()) / 86400000))
        setItems(prev =>
          prev.map(item =>
            item.id === id
              ? {
                  ...item,
                  status: 'scheduled' as const,
                  nextReviewDate: nextDate,
                  interval: daysUntil,
                }
              : item,
          ),
        );
        logActivity("error_review", "review", id, { success, algorithm });
        dispatchErrorBookChanged();
      }
    } catch {
      await fetchAll();
    }
  }

  async function rescheduleItem(id: string, newIntervalDays: number) {
    try {
      const res = await fetch('/api/error-book/schedule-review', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_id: id,
          algorithm: 'leitner',
          rating: newIntervalDays <= 1 ? 1 : newIntervalDays <= 3 ? 2 : newIntervalDays <= 7 ? 3 : 4,
        }),
      });
      if (!res.ok) {
        await fetchAll();
      } else {
        const data = await res.json() as { next_review_time: string };
        const nextDate = new Date(data.next_review_time).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        setItems(prev =>
          prev.map(item =>
            item.id === id
              ? {
                  ...item,
                  status: nextDate <= today ? 'due' as const : 'scheduled' as const,
                  nextReviewDate: nextDate,
                }
              : item,
          ),
        );
        dispatchErrorBookChanged();
      }
    } catch {
      await fetchAll();
    }
  }

  return {
    items,
    dueItems,
    upcomingItems,
    masteredItems,
    loading,
    error,
    markReviewed,
    rescheduleItem,
    refresh: fetchAll,
  };
}
