import { create } from 'zustand'

export interface Photo {
  id: string
  name: string
  url: string
  size: number
  date: number
  category: string[]
  width?: number
  height?: number
  isBlurry?: boolean
  isScreenshot?: boolean
  isSelfie?: boolean
  isVideo?: boolean
  isDuplicate?: boolean
  isSimilar?: boolean
  isLivePhoto?: boolean
  isOld?: boolean
  blurScore?: number
}

interface CategoryStats {
  id: string
  name: string
  icon: string
  count: number
  size: number
  color: string
}

interface PhotoState {
  photos: Photo[]
  selectedPhotos: Set<string>
  currentScreen: 'home' | 'category' | 'swipe' | 'smartClean' | 'results'
  activeCategory: string | null
  isLoading: boolean
  scanComplete: boolean
  maxPhotos: number
  hasPermission: boolean

  setPhotos: (photos: Photo[]) => void
  addPhotos: (photos: Photo[]) => void
  removePhotos: (ids: string[]) => void
  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  deletePhotos: (ids: string[]) => void
  setScreen: (screen: PhotoState['currentScreen']) => void
  setActiveCategory: (cat: string | null) => void
  setLoading: (loading: boolean) => void
  setScanComplete: (complete: boolean) => void
  setHasPermission: (has: boolean) => void
  getPhotosByCategory: (category: string) => Photo[]
  getTotalSize: () => number
  getSelectedSize: () => number
  getCategoryStats: () => CategoryStats[]
  reset: () => void
}

const MAX_PHOTOS = 30000

const CATEGORY_CONFIG: Array<{ id: string; name: string; icon: string; color: string }> = [
  { id: 'duplicates', name: 'Duplicates', icon: 'Copy', color: '#EF4444' },
  { id: 'screenshots', name: 'Screenshots', icon: 'Monitor', color: '#F59E0B' },
  { id: 'selfies', name: 'Selfies', icon: 'User', color: '#EC4899' },
  { id: 'videos', name: 'Videos', icon: 'Video', color: '#8B5CF6' },
  { id: 'similar', name: 'Similar', icon: 'Layers', color: '#3B82F6' },
  { id: 'blurry', name: 'Blurry', icon: 'Droplet', color: '#6366F1' },
  { id: 'largeFiles', name: 'Large Files', icon: 'HardDrive', color: '#F97316' },
  { id: 'oldPhotos', name: 'Old Photos', icon: 'Clock', color: '#78716C' },
]

export { CATEGORY_CONFIG }

export const usePhotoStore = create<PhotoState>()((set, get) => ({
  photos: [],
  selectedPhotos: new Set<string>(),
  currentScreen: 'home',
  activeCategory: null,
  isLoading: false,
  scanComplete: false,
  maxPhotos: MAX_PHOTOS,
  hasPermission: false,

  setPhotos: (photos: Photo[]) => set({ photos: photos.slice(0, MAX_PHOTOS) }),

  addPhotos: (newPhotos: Photo[]) => set((state) => {
    const combined = [...state.photos, ...newPhotos]
    return { photos: combined.slice(0, MAX_PHOTOS) }
  }),

  removePhotos: (ids: string[]) => set((state) => ({
    photos: state.photos.filter((p: Photo) => !ids.includes(p.id)),
    selectedPhotos: new Set([...state.selectedPhotos].filter((id: string) => !ids.includes(id)))
  })),

  toggleSelect: (id: string) => set((state) => {
    const newSet = new Set(state.selectedPhotos)
    if (newSet.has(id)) { newSet.delete(id) } else { newSet.add(id) }
    return { selectedPhotos: newSet }
  }),

  selectAll: (ids: string[]) => set({ selectedPhotos: new Set(ids) }),

  clearSelection: () => set({ selectedPhotos: new Set<string>() }),

  deletePhotos: (ids: string[]) => {
    set((state) => ({
      photos: state.photos.filter((p: Photo) => !ids.includes(p.id)),
      selectedPhotos: new Set([...state.selectedPhotos].filter((id: string) => !ids.includes(id)))
    }))
  },

  setScreen: (screen: PhotoState['currentScreen']) => set({ currentScreen: screen }),
  setActiveCategory: (cat: string | null) => set({ activeCategory: cat }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setScanComplete: (complete: boolean) => set({ scanComplete: complete }),
  setHasPermission: (has: boolean) => set({ hasPermission: has }),

  getPhotosByCategory: (category: string) => {
    const { photos } = get()
    return photos.filter((p: Photo) => p.category.includes(category))
  },

  getTotalSize: () => get().photos.reduce((acc: number, p: Photo) => acc + p.size, 0),

  getSelectedSize: () => {
    const { photos, selectedPhotos } = get()
    return photos.filter((p: Photo) => selectedPhotos.has(p.id)).reduce((acc: number, p: Photo) => acc + p.size, 0)
  },

  getCategoryStats: () => {
    const { photos } = get()
    return CATEGORY_CONFIG.map((cat) => ({
      ...cat,
      count: photos.filter((p: Photo) => p.category.includes(cat.id)).length,
      size: photos.filter((p: Photo) => p.category.includes(cat.id)).reduce((acc: number, p: Photo) => acc + p.size, 0)
    }))
  },

  reset: () => set({
    photos: [],
    selectedPhotos: new Set<string>(),
    currentScreen: 'home',
    activeCategory: null,
    isLoading: false,
    scanComplete: false,
  }),
}))
