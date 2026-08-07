import { useMemo } from 'react';

// You should adjust the import to match your actual types path
// import { Priority, Recurrence } from '../types';

export type Priority = 'P1' | 'P2' | 'P3' | 'P4' | null;
export type Recurrence = 'daily' | 'weekly' | 'monthly' | null;

export interface ParsedTask {
  cleanTitle: string;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
  listName: string | null;
  estimate: number | null; // minutes
  recurrence: Recurrence;
  isLeetCode: boolean;
}

export function parseTaskInput(text: string): ParsedTask {
  let cleanTitle = text;
  let priority: Priority = null;
  let dueDate: string | null = null;
  let tags: string[] = [];
  let listName: string | null = null;
  let estimate: number | null = null;
  let recurrence: Recurrence = null;
  let isLeetCode = false;

  // 1. Priority
  const p1Regex = /!(p1|urgent|high)\b/i;
  const p2Regex = /!(p2|medium)\b/i;
  const p3Regex = /!(p3)\b/i;
  const p4Regex = /!(p4|low)\b/i;

  if (p1Regex.test(cleanTitle)) { priority = 'P1'; cleanTitle = cleanTitle.replace(p1Regex, ''); }
  else if (p2Regex.test(cleanTitle)) { priority = 'P2'; cleanTitle = cleanTitle.replace(p2Regex, ''); }
  else if (p3Regex.test(cleanTitle)) { priority = 'P3'; cleanTitle = cleanTitle.replace(p3Regex, ''); }
  else if (p4Regex.test(cleanTitle)) { priority = 'P4'; cleanTitle = cleanTitle.replace(p4Regex, ''); }

  // 2. Due Date
  const todayRegex = /\btoday\b/i;
  const tomorrowRegex = /\btomorrow\b/i;
  const nextDayRegex = /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const timeRegex = /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})\b/i;

  let baseDate = new Date();
  let timeStr = "23:59";
  let hasDate = false;

  if (todayRegex.test(cleanTitle)) {
    hasDate = true;
    cleanTitle = cleanTitle.replace(todayRegex, '');
  } else if (tomorrowRegex.test(cleanTitle)) {
    hasDate = true;
    baseDate.setDate(baseDate.getDate() + 1);
    cleanTitle = cleanTitle.replace(tomorrowRegex, '');
  } else {
    const nextDayMatch = cleanTitle.match(nextDayRegex);
    if (nextDayMatch) {
      hasDate = true;
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = dayNames.indexOf(nextDayMatch[1].toLowerCase());
      const currentDay = baseDate.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      baseDate.setDate(baseDate.getDate() + daysToAdd);
      cleanTitle = cleanTitle.replace(nextDayMatch[0], '');
    }
  }

  const timeMatch = cleanTitle.match(timeRegex);
  if (timeMatch) {
    hasDate = true;
    const timeVal = timeMatch[1].toLowerCase();
    timeStr = timeVal; 
    cleanTitle = cleanTitle.replace(timeMatch[0], '');
  }

  if (hasDate) {
      dueDate = `${baseDate.toISOString().split('T')[0]}T${timeStr}`;
  }

  // 3. Estimate
  const estimateRegex = /~(\d+(?:\.\d+)?)(m|h)/i;
  const estimateMatch = cleanTitle.match(estimateRegex);
  if (estimateMatch) {
    const val = parseFloat(estimateMatch[1]);
    const unit = estimateMatch[2].toLowerCase();
    estimate = unit === 'h' ? val * 60 : val;
    cleanTitle = cleanTitle.replace(estimateRegex, '');
  }

  // 4. Tags
  const tagRegex = /#(\w+)/g;
  let match;
  while ((match = tagRegex.exec(cleanTitle)) !== null) {
    tags.push(match[1]);
  }
  cleanTitle = cleanTitle.replace(tagRegex, '');

  // 5. List Name
  const listRegex = /\^(\w+)/i;
  const listMatch = cleanTitle.match(listRegex);
  if (listMatch) {
    listName = listMatch[1];
    cleanTitle = cleanTitle.replace(listRegex, '');
  }

  // 6. Recurrence
  const recurrenceRegex = /repeat:(daily|weekly|monthly)/i;
  const recMatch = cleanTitle.match(recurrenceRegex);
  if (recMatch) {
    recurrence = recMatch[1].toLowerCase() as Recurrence;
    cleanTitle = cleanTitle.replace(recurrenceRegex, '');
  }

  // 7. LeetCode / HackerRank
  const lcRegex = /leetcode\.com|hackerrank\.com/i;
  if (lcRegex.test(cleanTitle)) {
    isLeetCode = true;
  }

  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  return {
    cleanTitle,
    priority,
    dueDate,
    tags,
    listName,
    estimate,
    recurrence,
    isLeetCode,
  };
}

export function useTaskParser(text: string): ParsedTask {
  return useMemo(() => parseTaskInput(text), [text]);
}
