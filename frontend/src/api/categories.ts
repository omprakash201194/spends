import apiClient from './client'

export interface Category {
  id: string
  name: string
  icon: string | null
  color: string | null
  system: boolean
  parentId: string | null
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>('/categories')
  return data
}

export async function createCategory(
  name: string,
  color: string,
  parentId?: string | null,
): Promise<Category> {
  const { data } = await apiClient.post<Category>('/categories', { name, color, parentId: parentId ?? null })
  return data
}

export async function updateCategory(
  id: string,
  name: string,
  color: string,
  parentId?: string | null,
  clearParent?: boolean,
): Promise<Category> {
  const { data } = await apiClient.put<Category>(`/categories/${id}`, {
    name,
    color,
    parentId: parentId ?? null,
    clearParent: clearParent ?? false,
  })
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`)
}

export interface CategoryNode extends Category {
  children: CategoryNode[]
}

export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>()
  const roots: CategoryNode[] = []

  for (const cat of categories) {
    byId.set(cat.id, { ...cat, children: [] })
  }
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export interface FlatCategoryWithDepth {
  category: Category
  depth: number
}

export function flattenWithDepth(nodes: CategoryNode[], depth = 0): FlatCategoryWithDepth[] {
  const result: FlatCategoryWithDepth[] = []
  for (const node of nodes) {
    result.push({ category: node, depth })
    if (node.children.length > 0) {
      result.push(...flattenWithDepth(node.children, depth + 1))
    }
  }
  return result
}
