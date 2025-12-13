export interface SubcategoryCount {
  subcategory: string;
  count: number;
}

export interface CategoryProjectCounts {
  category: string;
  total_count: number;
  subcategory_counts: SubcategoryCount[];
}

/**
 * Compute category and subcategory counts from a list of project documents.
 * - `projects`: array of project objects as returned by the API
 * - `profSubs`: optional array of professional-selected subcategories to filter by
 */
export function computeCountsFromProjects(projects: any[], profSubs: string[] = []): CategoryProjectCounts[] {
  const categoriesMap: Record<string, any> = {};

  (projects || []).forEach((p: any) => {
    const sub = (p.category && typeof p.category === 'object' && p.category.sub) ? p.category.sub : '';
    if (profSubs.length > 0 && sub && !profSubs.includes(sub)) return; // only count selected subs

    const catName = (p.category && typeof p.category === 'object' && p.category.main) ? p.category.main : (typeof p.category === 'string' ? p.category : 'Outros');
    if (!categoriesMap[catName]) categoriesMap[catName] = { category: catName, total_count: 0, subcategory_counts: {} };

    categoriesMap[catName].total_count += 1;
    const subKey = sub || 'Sem subcategoria';
    categoriesMap[catName].subcategory_counts[subKey] = (categoriesMap[catName].subcategory_counts[subKey] || 0) + 1;
  });

  return Object.values(categoriesMap).map((c: any) => ({
    category: c.category,
    total_count: c.total_count,
    subcategory_counts: Object.entries(c.subcategory_counts).map(([subcategory, count]) => ({ subcategory, count }))
  }));
}

export default computeCountsFromProjects;
