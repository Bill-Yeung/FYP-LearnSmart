import React, { useState } from 'react';
import { useScheduleErrorReview, type ScheduledErrorItem } from '../../hooks/useScheduleErrorReview';

const rescheduleOptions = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
];

function ReviewCard({
  item,
  onMark,
  onReschedule,
}: {
  item: ScheduledErrorItem;
  onMark: (id: string, success: boolean) => Promise<void>;
  onReschedule: (id: string, days: number) => Promise<void>;
}) {
  const [revealed, setRevealed] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleMark(success: boolean) {
    setBusy(true);
    await onMark(item.id, success);
    setDone(true);
    setBusy(false);
  }

  async function handleReschedule(days: number) {
    setBusy(true);
    await onReschedule(item.id, days);
    setShowReschedule(false);
    setDone(true);
    setBusy(false);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 px-5 py-3 flex items-center gap-3">
        <svg className="h-5 w-5 text-emerald-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 line-clamp-1">
          Reviewed: {item.question}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-3 bg-orange-50 dark:bg-orange-900/10 border-b border-orange-200 dark:border-orange-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/40 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
            Due now
          </span>
          {item.categoryLabel && (
            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              {item.categoryLabel}
            </span>
          )}
          {item.topic && (
            <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
              {item.topic}
            </span>
          )}
          {item.sourceExam && (
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
              {item.sourceExam}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {item.interval === 0 ? 'First review' : `${item.interval} review${item.interval !== 1 ? 's' : ''} done`} · {item.lastErrorDate}
        </span>
      </div>

      {/* Question */}
      <div className="px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">Question</p>
        <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed">{item.question}</p>
      </div>

      {/* Reveal / answers */}
      {!revealed ? (
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="w-full py-2.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition"
          >
            Reveal answer &amp; explanation
          </button>
        </div>
      ) : (
        <div className="px-5 pb-5 space-y-3">
          {item.wrongAnswer && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500 dark:text-red-400 mb-1">Your wrong answer</p>
              <p className="text-sm text-red-800 dark:text-red-200">{item.wrongAnswer}</p>
            </div>
          )}
          {item.correctAnswer && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">Correct answer</p>
              <p className="text-sm text-emerald-900 dark:text-emerald-100">{item.correctAnswer}</p>
            </div>
          )}
          {item.explanation && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400 mb-1">Explanation</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{item.explanation}</p>
            </div>
          )}
          {item.reflectionNotes && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Your notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item.reflectionNotes}</p>
            </div>
          )}

          {!showReschedule ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleMark(true)}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {busy ? 'Saving…' : '✓ Remembered'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleMark(false)}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-sm font-semibold transition disabled:opacity-50"
              >
                {busy ? 'Saving…' : '✗ Forgot'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowReschedule(true)}
                className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
              >
                Reschedule
              </button>
            </div>
          ) : (
            <div className="pt-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Choose next review interval:</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {rescheduleOptions.map(opt => (
                  <button
                    key={opt.days}
                    type="button"
                    disabled={busy}
                    onClick={() => handleReschedule(opt.days)}
                    className="py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowReschedule(false)}
                className="mt-2 text-xs text-gray-500 dark:text-gray-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorListRow({ item }: { item: ScheduledErrorItem }) {
  const [open, setOpen] = useState(false);

  const nextLabel = item.nextReviewDate
    ? new Date(item.nextReviewDate).toLocaleDateString()
    : '—';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {item.status === 'mastered' ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                Mastered
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Next: {nextLabel}
              </span>
            )}
            {item.categoryLabel && (
              <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                {item.categoryLabel}
              </span>
            )}
            {item.topic && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">{item.topic}</span>
            )}
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-1">{item.question}</p>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 mt-1 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-2">
          {item.wrongAnswer && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500 mb-0.5">Your wrong answer</p>
              <p className="text-sm text-red-800 dark:text-red-200">{item.wrongAnswer}</p>
            </div>
          )}
          {item.correctAnswer && (
            <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 mb-0.5">Correct answer</p>
              <p className="text-sm text-emerald-900 dark:text-emerald-100">{item.correctAnswer}</p>
            </div>
          )}
          {item.explanation && (
            <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500 mb-0.5">Explanation</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{item.explanation}</p>
            </div>
          )}
          {item.reflectionNotes && (
            <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Your notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{item.reflectionNotes}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
            First wrong: {item.lastErrorDate} · {item.interval} review{item.interval !== 1 ? 's' : ''} done
            {item.sourceExam ? ` · ${item.sourceExam}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
        {count}
      </span>
    </div>
  );
}

const ScheduleErrorReview: React.FC = () => {
  const { dueItems, upcomingItems, masteredItems, loading, error, markReviewed, rescheduleItem } = useScheduleErrorReview();

  const totalItems = dueItems.length + upcomingItems.length + masteredItems.length;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Error Review</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            All your logged errors. Due items appear at the top — reveal the answer, then mark your recall.
          </p>
        </div>
        {!loading && !error && (
          <div className="flex gap-3 text-sm">
            {dueItems.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 inline-block" />
                {dueItems.length} due now
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
              {totalItems} total
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-12 justify-center text-gray-400 dark:text-gray-500 text-sm">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading your errors…
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 flex gap-3">
          <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && totalItems === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <svg className="h-14 w-14 text-gray-300 dark:text-gray-600 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-base font-semibold text-gray-600 dark:text-gray-300">No errors logged yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Wrong answers from quizzes will appear here automatically.</p>
        </div>
      )}

      {!loading && !error && totalItems > 0 && (
        <div className="space-y-8">

          {dueItems.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                title="Due for Review"
                count={dueItems.length}
                color="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
              />
              <div className="space-y-4">
                {dueItems.map(item => (
                  <ReviewCard
                    key={item.id}
                    item={item}
                    onMark={markReviewed}
                    onReschedule={rescheduleItem}
                  />
                ))}
              </div>
            </section>
          )}

          {dueItems.length === 0 && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 px-5 py-4 flex items-center gap-3">
              <svg className="h-5 w-5 text-emerald-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">All caught up — no reviews due today!</p>
            </div>
          )}

          {upcomingItems.length > 0 && (
            <section className="space-y-2">
              <SectionHeader
                title="Upcoming"
                count={upcomingItems.length}
                color="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              />
              <div className="space-y-2">
                {upcomingItems.map(item => (
                  <ErrorListRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {masteredItems.length > 0 && (
            <section className="space-y-2">
              <SectionHeader
                title="Mastered"
                count={masteredItems.length}
                color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
              />
              <div className="space-y-2">
                {masteredItems.map(item => (
                  <ErrorListRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduleErrorReview;
