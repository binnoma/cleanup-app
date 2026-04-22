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
  isLarge?: boolean
  blurScore?: number
  nativePath?: string
  contentUri?: string
  photoType?: 'image' | 'video'
  mimeType?: string
  analyzed?: boolean
  thumbnailLoaded?: boolean
}

interface CategoryStats {
  id: string
  name: string
  icon: string
  count: number
  size: number
  color: string
}

export type ScanPhase = 'idle' | 'requesting' | 'scanning' | 'analyzing' | 'categorizing' | 'done'
export type AppScreen = 'home' | 'category' | 'swipe' | 'smartClean' | 'results'

interface PhotoState {
  photos: Photo[]
  selectedPhotos: Set<string>
  currentScreen: AppScreen
  activeCategory: string | null
  isLoading: boolean
  scanComplete: boolean
  scanPhase: ScanPhase
  scanProgress: number
  scanStatusText: string
  totalFound: number
  analyzedCount: number
  hasPermission: boolean
  isNative: boolean
  maxPhotos: number

  setPhotos: (photos: Photo[]) => void
  addPhotos: (photos: Photo[]) => void
  removePhotos: (ids: string[]) => void
  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  deletePhotos: (ids: string[]) => void
  setScreen: (screen: AppScreen) => void
  setActiveCategory: (cat: string | null) => void
  setLoading: (loading: boolean) => void
  setScanComplete: (complete: boolean) => void
  setScanPhase: (phase: ScanPhase) => void
  setScanProgress: (progress: number) => void
  setScanStatusText: (text: string) => void
  setTotalFound: (count: number) => void
  setAnalyzedCount: (count: number) => void
  setHasPermission: (has: boolean) => void
  setIsNative: (isNative: boolean) => void
  updatePhoto: (id: string, updates: Partial<Photo>) => void
  updatePhotoThumbnail: (contentUri: string, thumbnailUrl: string) => void
  getPhotosByCategory: (category: string) => Photo[]
  getTotalSize: () => number
  getSelectedSize: () => number
  getCategoryStats: () => CategoryStats[]
  reset: () => void
}

const MAX_PHOTOS = 30000

const CATEGORY_CONFIG: Array<{ id: string; name: string; icon: string; color: string }> = [
  { id: 'duplicates', name: 'Duplicates', icon: 'Copy', color: '#EF4444' },
  { id: 'similar', name: 'Similar', icon: 'Layers', color: '#3B82F6' },
  { id: 'blurry', name: 'Blurry', icon: 'Droplet', color: '#6366F1' },
  { id: 'screenshots', name: 'Screenshots', icon: 'Monitor', color: '#F59E0B' },
  { id: 'selfies', name: 'Selfies', icon: 'User', color: '#EC4899' },
  { id: 'videos', name: 'Videos', icon: 'Video', color: '#8B5CF6' },
  { id: 'livePhotos', name: 'Live Photos', icon: 'Camera', color: '#10B981' },
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
  scanPhase: 'idle',
  scanProgress: 0,
  scanStatusText: '',
  totalFound: 0,
  analyzedCount: 0,
  hasPermission: false,
  isNative: false,
  maxPhotos: MAX_PHOTOS,

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

  setScreen: (screen: AppScreen) => set({ currentScreen: screen }),
  setActiveCategory: (cat: string | null) => set({ activeCategory: cat }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setScanComplete: (complete: boolean) => set({ scanComplete: complete }),
  setScanPhase: (phase: ScanPhase) => set({ scanPhase: phase }),
  setScanProgress: (progress: number) => set({ scanProgress: progress }),
  setScanStatusText: (text: string) => set({ scanStatusText: text }),
  setTotalFound: (count: number) => set({ totalFound: count }),
  setAnalyzedCount: (count: number) => set({ analyzedCount: count }),
  setHasPermission: (has: boolean) => set({ hasPermission: has }),
  setIsNative: (isNative: boolean) => set({ isNative }),

  updatePhoto: (id: string, updates: Partial<Photo>) => set((state) => ({
    photos: state.photos.map((p: Photo) => p.id === id ? { ...p, ...updates } : p)
  })),

  updatePhotoThumbnail: (contentUri: string, thumbnailUrl: string) => set((state) => ({
    photos: state.photos.map((p: Photo) =>
      p.contentUri === contentUri ? { ...p, url: thumbnailUrl, thumbnailLoaded: true } : p
    )
  })),

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
    scanPhase: 'idle',
    scanProgress: 0,
    scanStatusText: '',
    totalFound: 0,
    analyzedCount: 0,
  }),
}))
