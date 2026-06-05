import type { Task, TaskTemplateWithFiles } from '../types';

/**
 * Demo/mock template IDs emitted by the SOW parser → category names on the
 * live sheet (Task Templates tab). Used to map suggestions onto real templates.
 */
export const MOCK_TEMPLATE_CATEGORIES: Record<string, string[]> = {
  'tpl-sow': ['SOW'],
  'tpl-lem': ['LEM'],
  'tpl-venue': ['Venue'],
  'tpl-av': ['AV'],
  'tpl-av-equipment': ['AV'],
  'tpl-interpretation': ['Interpretation', 'Interpreters'],
  'tpl-printing': ['Printing'],
  'tpl-registration': ['Registration'],
  'tpl-catering': ['Catering'],
  'tpl-photography': ['Photography', 'Media'],
  'tpl-internet': ['Internet', 'AV'],
  'tpl-per-diem': ['Finance', 'Per Diem'],
  'tpl-per-diem-form': ['Finance', 'Per Diem'],
  'tpl-lodging': ['Logistics', 'Travel'],
  'tpl-transportation': ['Transportation', 'Travel', 'Logistics'],
  'tpl-transfer': ['Transportation', 'Travel', 'Logistics'],
};

/** Map SOW parser mock IDs (or real IDs) to template IDs present in the sheet. */
export function resolveTemplateIds(
  suggested: string[],
  templates: TaskTemplateWithFiles[],
): string[] {
  const active = templates.filter(
    (t) => String(t.template.active).toLowerCase() !== 'no',
  );
  const knownIds = new Set(active.map((t) => t.template.templateId));

  const byCategory = new Map<string, string[]>();
  for (const { template } of active) {
    const key = template.category.trim().toLowerCase();
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(template.templateId);
  }

  const resolved = new Set<string>();
  for (const id of suggested) {
    if (knownIds.has(id)) {
      resolved.add(id);
      continue;
    }
    const categories = MOCK_TEMPLATE_CATEGORIES[id];
    if (!categories) continue;
    for (const cat of categories) {
      const matches = byCategory.get(cat.toLowerCase()) ?? [];
      if (matches.length) {
        resolved.add(matches[0]);
        break;
      }
    }
  }
  return [...resolved];
}

export function isTemplateSuggested(
  templateId: string,
  suggested: string[],
  templates: TaskTemplateWithFiles[],
): boolean {
  return resolveTemplateIds(suggested, templates).includes(templateId);
}

/** Prefer explicit SOW task when attaching the uploaded PDF. */
export function findSowTask(tasks: Task[]): Task | undefined {
  return (
    tasks.find((t) => t.templateId === 'tpl-sow') ??
    tasks.find((t) => t.category?.trim().toLowerCase() === 'sow') ??
    tasks.find((t) => /\bsow\b/i.test(t.title)) ??
    tasks[0]
  );
}
