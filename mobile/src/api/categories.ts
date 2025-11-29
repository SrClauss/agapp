import { BACKEND_URL } from './config';

export interface SubcategoryWithParent {
  id: string; // parent category id
  name: string;
  tags: string[];
  parent: {
    id: string;
    name: string;
  };
}

export interface CategoryAPI {
  id: string;
  name: string;
  tags?: string[];
  subcategories?: Array<{ name: string; tags?: string[] }>; // server uses subcategories as array of objects
}

export async function getCategories(): Promise<CategoryAPI[]> {
  const res = await fetch(`${BACKEND_URL}/categories`);
  if (!res.ok) throw new Error('Falha ao listar categorias');
  return res.json();
}

export async function getSubcategoriesWithParent(): Promise<SubcategoryWithParent[]> {
  const categories = await getCategories();
  const results: SubcategoryWithParent[] = [];

  categories.forEach((cat) => {
    const parentId = (cat as any).id || (cat as any)._id || '';
    const subcategories = cat.subcategories || [];
    subcategories.forEach((sub: { name: string; tags?: string[] }) => {
      results.push({
        id: parentId,
        name: sub.name,
        tags: sub.tags || [],
        parent: {
          id: parentId,
          name: cat.name,
        },
      });
    });
  });

  return results;
}
