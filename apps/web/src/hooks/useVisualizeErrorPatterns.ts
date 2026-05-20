import { useState, useMemo } from 'react';

export interface ErrorTag {
  id: string;
  name: string;
  count: number;
  color: string;
}

export interface Concept {
  id: string;
  name: string;
  relatedErrors: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface ErrorPattern {
  id: string;
  errorType: string;
  description: string;
  tags: ErrorTag[];
  concepts: Concept[];
  frequency: number;
}

export interface UseVisualizeErrorPatternsResult {
  patterns: ErrorPattern[];
  allTags: ErrorTag[];
  selectedFilter: string | null;
  setSelectedFilter: (filter: string | null) => void;
  filteredPatterns: ErrorPattern[];
  sampleMode: boolean;
}

const initialFakePatterns: ErrorPattern[] = [
  {
    id: '1',
    errorType: 'Calculation Errors',
    description: 'Arithmetic mistakes and computational slip-ups',
    tags: [
      { id: 'tag-1', name: 'Arithmetic', count: 12, color: '#EF4444' },
      { id: 'tag-2', name: 'Algebraic Manipulation', count: 8, color: '#F97316' },
    ],
    concepts: [
      { id: 'concept-1', name: 'Order of Operations', relatedErrors: ['tag-1', 'tag-2'], severity: 'high' },
      { id: 'concept-2', name: 'Sign Rules', relatedErrors: ['tag-1'], severity: 'medium' },
    ],
    frequency: 20,
  },
  {
    id: '2',
    errorType: 'Conceptual Misunderstanding',
    description: 'Fundamental misconceptions about concepts',
    tags: [
      { id: 'tag-3', name: 'Physics Concepts', count: 7, color: '#3B82F6' },
      { id: 'tag-4', name: 'Mechanics', count: 5, color: '#06B6D4' },
    ],
    concepts: [
      { id: 'concept-3', name: 'Newton\'s Laws', relatedErrors: ['tag-3', 'tag-4'], severity: 'high' },
      { id: 'concept-4', name: 'Forces and Motion', relatedErrors: ['tag-4'], severity: 'high' },
    ],
    frequency: 12,
  },
  {
    id: '3',
    errorType: 'Process Slip',
    description: 'Execution mistakes despite understanding',
    tags: [
      { id: 'tag-5', name: 'Notation Errors', count: 6, color: '#8B5CF6' },
      { id: 'tag-6', name: 'Formula Application', count: 4, color: '#D946EF' },
    ],
    concepts: [
      { id: 'concept-5', name: 'Standard Notation', relatedErrors: ['tag-5'], severity: 'medium' },
    ],
    frequency: 10,
  },
];

export function useVisualizeErrorPatterns(): UseVisualizeErrorPatternsResult {
  const [patterns] = useState<ErrorPattern[]>(initialFakePatterns);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const sampleMode = true;

  const allTags = useMemo(() => {
    const tagMap = new Map<string, ErrorTag>();
    patterns.forEach(pattern => {
      pattern.tags.forEach(tag => {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, tag);
        }
      });
    });
    return Array.from(tagMap.values());
  }, [patterns]);

  const filteredPatterns = useMemo(() => {
    if (!selectedFilter) return patterns;
    return patterns.filter(pattern =>
      pattern.tags.some(tag => tag.id === selectedFilter)
    );
  }, [patterns, selectedFilter]);

  return {
    patterns,
    allTags,
    selectedFilter,
    setSelectedFilter,
    filteredPatterns,
    sampleMode,
  };
}
