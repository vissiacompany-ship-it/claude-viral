import { Carousel } from '@/types'

export type CarouselSortOrder = 'recent' | 'oldest' | 'az'

export const CAROUSEL_SORT_LABELS: Record<CarouselSortOrder, string> = {
  recent: 'Mais recentes primeiro',
  oldest: 'Mais antigos primeiro',
  az: 'Título (A-Z)',
}

export function sortCarousels(list: Carousel[], order: CarouselSortOrder): Carousel[] {
  const sorted = [...list]
  if (order === 'az') return sorted.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  return order === 'recent' ? sorted.reverse() : sorted
}
