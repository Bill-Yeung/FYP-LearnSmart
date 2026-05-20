import React, { useState } from 'react';
import { useVisualizeErrorPatterns } from '../../hooks/useVisualizeErrorPatterns';

function VisualizeErrorPatternsInner() {
  const { allTags, filteredPatterns, selectedFilter, setSelectedFilter, sampleMode } = useVisualizeErrorPatterns();
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);

  const handleTagClick = (tagId: string) => {
    setSelectedFilter(selectedFilter === tagId ? null : tagId);
  };

  const tagsToShow = selectedFilter ? allTags.filter(t => t.id === selectedFilter) : allTags;

  return (
    <div className="p-6 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm">
      <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Error Pattern Visualization</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Explore how mistakes relate to broader knowledge structures through concept maps.
      </p>

      {sampleMode && (
        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded text-sm text-gray-700 dark:text-gray-200">
          Sample mode: data resets on refresh.
        </div>
      )}

      {/* Filter Tags */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Filter by Error Tag:</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedFilter(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition ${
              selectedFilter === null
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleTagClick(tag.id)}
              className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 ${selectedFilter === tag.id ? 'ring-2 ring-gray-400 dark:ring-gray-600' : ''}`}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.name} ({tag.count})
            </button>
          ))}
        </div>
      </div>

      {/* Grouped by tag */}
      <div className="space-y-4">
        {tagsToShow.map(tag => {
          const patternsForTag = filteredPatterns.filter(p => p.tags.some(t => t.id === tag.id));
          return (
            <div key={tag.id} className="border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tag.name}</span>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">{tag.count} occurrences</span>
              </div>

              {patternsForTag.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">No patterns for this tag.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {patternsForTag.map(pattern => (
                    <div
                      key={pattern.id}
                      className="p-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-md hover:shadow-sm transition"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{pattern.errorType}</h4>
                        <span className="text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded">{pattern.frequency} errors</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 leading-snug">{pattern.description}</p>

                      <div className="flex flex-wrap gap-1 mb-2">
                        {pattern.tags.map(t => (
                          <span key={t.id} className="text-[11px] px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                            {t.name}
                          </span>
                        ))}
                      </div>

                      {expandedPattern === pattern.id && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <h5 className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 mb-1">Related concepts</h5>
                          <ul className="space-y-1">
                            {pattern.concepts.map(concept => (
                              <li
                                key={concept.id}
                                className={`text-[11px] p-2 rounded ${
                                  concept.severity === 'high'
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                                    : concept.severity === 'medium'
                                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                      : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                }`}
                              >
                                <span className="font-medium">{concept.name}</span>
                                <span className="ml-1 text-[10px] text-gray-600 dark:text-gray-300">Severity: {concept.severity}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedPattern(expandedPattern === pattern.id ? null : pattern.id)}
                        className="mt-2 text-[11px] text-gray-700 dark:text-gray-300 hover:underline cursor-pointer"
                      >
                        {expandedPattern === pattern.id ? 'Hide concepts' : 'Show concepts'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPatterns.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No error patterns match the selected filter.</p>
        </div>
      )}

      {/* Mind Map Legend */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Severity indicators</h4>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            <span>High priority</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
            <span>Medium priority</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            <span>Low priority</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VisualizeErrorPatternsPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <VisualizeErrorPatternsInner />
      </main>
    </div>
  )
}

export default VisualizeErrorPatternsPage
