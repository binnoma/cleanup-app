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
  currentScreen: 'home' | 'category' | 'swipe' | 'smartClean' | 'import' | 'results'
  activeCategory: string | null
  isLoading: boolean
  scanComplete: boolean
  maxPhotos: number

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
  getPhotosByCategory: (category: string) => Photo[]
  generateDemoData: () => void
  getTotalSize: () => number
  getSelectedSize: () => number
  getCategoryStats: () => CategoryStats[]
}

const MAX_PHOTOS = 30000

const CATEGORY_CONFIG: Array<{ id: string; name: string; icon: string; color: string }> = [
  { id: 'duplicates', name: 'Duplicates', icon: 'Copy', color: '#EF4444' },
  { id: 'screenshots', name: 'Screenshots', icon: 'Monitor', color: '#F59E0B' },
  { id: 'selfies', name: 'Selfies', icon: 'User', color: '#EC4899' },
  { id: 'videos', name: 'Videos', icon: 'Video', color: '#8B5CF6' },
  { id: 'similar', name: 'Similar', icon: 'Layers', color: '#3B82F6' },
  { id: 'blurry', name: 'Blurry', icon: 'Droplet', color: '#6366F1' },
  { id: 'livePhotos', name: 'Live Photos', icon: 'Sparkles', color: '#14B8A6' },
  { id: 'oldPhotos', name: 'Old Photos', icon: 'Clock', color: '#78716C' },
  { id: 'allPhotos', name: 'All Photos', icon: 'Grid', color: '#10B981' },
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
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
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

  getPhotosByCategory: (category: string) => {
    const { photos } = get()
    if (category === 'allPhotos') return photos
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
      count: cat.id === 'allPhotos' ? photos.length : photos.filter((p: Photo) => p.category.includes(cat.id)).length,
      size: cat.id === 'allPhotos'
        ? photos.reduce((acc: number, p: Photo) => acc + p.size, 0)
        : photos.filter((p: Photo) => p.category.includes(cat.id)).reduce((acc: number, p: Photo) => acc + p.size, 0)
    }))
  },

  generateDemoData: () => {
    const photos: Photo[] = []
    const now = Date.now()
    const dayMs = 86400000

    const demoImages = [
      'https://picsum.photos/seed/clean1/400/400',
      'https://picsum.photos/seed/clean2/400/400',
      'https://picsum.photos/seed/clean3/400/400',
      'https://picsum.photos/seed/clean4/400/400',
      'https://picsum.photos/seed/clean5/400/400',
      'https://picsum.photos/seed/clean6/400/400',
      'https://picsum.photos/seed/clean7/400/400',
      'https://picsum.photos/seed/clean8/400/400',
      'https://picsum.photos/seed/clean9/400/400',
      'https://picsum.photos/seed/clean10/400/400',
      'https://picsum.photos/seed/clean11/400/400',
      'https://picsum.photos/seed/clean12/400/400',
      'https://picsum.photos/seed/selfie1/400/400',
      'https://picsum.photos/seed/selfie2/400/400',
      'https://picsum.photos/seed/selfie3/400/400',
      'https://picsum.photos/seed/scrn1/400/400',
      'https://picsum.photos/seed/scrn2/400/400',
      'https://picsum.photos/seed/scrn3/400/400',
      'https://picsum.photos/seed/vid1/400/400',
      'https://picsum.photos/seed/vid2/400/400',
      'https://picsum.photos/seed/blur1/400/400',
      'https://picsum.photos/seed/blur2/400/400',
      'https://picsum.photos/seed/blur3/400/400',
      'https://picsum.photos/seed/live1/400/400',
      'https://picsum.photos/seed/live2/400/400',
      'https://picsum.photos/seed/old1/400/400',
      'https://picsum.photos/seed/old2/400/400',
      'https://picsum.photos/seed/old3/400/400',
    ]

    // Generate duplicates
    for (let i = 0; i < 15; i++) {
      const idx = i % demoImages.length
      const baseDate = now - Math.floor(Math.random() * 90) * dayMs
      photos.push({
        id: `dup-${i}`,
        name: `IMG_${1000 + i}.jpg`,
        url: demoImages[idx],
        size: 2000000 + Math.floor(Math.random() * 3000000),
        date: baseDate,
        category: ['duplicates', 'allPhotos'],
        isDuplicate: true,
      })
    }

    // Generate screenshots
    for (let i = 0; i < 20; i++) {
      const idx = (i + 5) % demoImages.length
      const baseDate = now - Math.floor(Math.random() * 60) * dayMs
      photos.push({
        id: `scr-${i}`,
        name: `Screenshot_${100 + i}.png`,
        url: demoImages[idx],
        size: 500000 + Math.floor(Math.random() * 1500000),
        date: baseDate,
        category: ['screenshots', 'allPhotos'],
        isScreenshot: true,
      })
    }

    // Generate selfies
    for (let i = 0; i < 12; i++) {
      const idx = (i + 10) % demoImages.length
      const baseDate = now - Math.floor(Math.random() * 120) * dayMs
      photos.push({
        id: `self-${i}`,
        name: `Selfie_${50 + i}.jpg`,
        url: demoImages[idx],
        size: 1500000 + Math.floor(Math.random() * 2500000),
        date: baseDate,
        category: ['selfies', 'allPhotos'],
        isSelfie: true,
      })
    }

    // Generate videos
    for (let i = 0; i < 8; i++) {
      const idx = (i + 15) % demoImages.length
      const baseDate = now - Math.floor(Math.random() * 200) * dayMs
      photos.push({
        id: `vid-${i}`,
        name: `VID_${200 + i}.mp4`,
        url: demoImages[idx],
        size: 15000000 + Math.floor(Math.random() * 85000000),
        date: baseDate,
        category: ['videos', 'allPhotos'],
        isVideo: true,
      })
    }

    // Generate similar photos
    for (let i = 0; i < 18; i++) {
      const idx = (i + 3) % demoImages.length
      const baseDate = now - Math.floor(Math.random() * 100) * dayMs
      photos.push({
        id: `sim-${i}`,
        name: `IMG_${2000 + i}.jpg`,
        url: demoImages[idx],
        size: 1800000 + Math.floor(Math.random() * 2200000),
        date: baseDate,
        category: ['similar', 'allPhotos'],
        isSimilar: true,
      })
    }

    // Generate blurry photos
    for (let i = 0; i < 10; i++) {
      const idx = (i + 18) % demoImages.length
      const baseDate = now - Math.floor(Math.random() * 150) * dayMs
      photos.push({
        id: `blur-${i}`,
        name: `IMG_${3000 + i}.jpg`,
        url: demoImages[idx],
        size: 1200000 + Math.floor(Math.random() * 1800000),
        date: baseDate,
        category: ['blurry', 'allPhotos'],
        isBlurry: true,
      })
    }

    // Generate live photos
    for (let i = 0; i < 7; i++) {
      const idx = (i + 21) % demoImages.length
      const baseDate = now - Math.floor(Math.random() * 80) * dayMs
      photos.push({
        id: `live-${i}`,
        name: `IMG_${4000 + i}.jpg`,
        url: demoImages[idx],
        size: 3500000 + Math.floor(Math.random() * 4000000),
        date: baseDate,
        category: ['livePhotos', 'allPhotos'],
        isLivePhoto: true,
      })
    }

    // Generate old photos
    for (let i = 0; i < 14; i++) {
      const idx = (i + 24) % demoImages.length
      const baseDate = now - (365 + Math.floor(Math.random() * 730)) * dayMs
      photos.push({
        id: `old-${i}`,
        name: `IMG_${5000 + i}.jpg`,
        url: demoImages[idx],
        size: 800000 + Math.floor(Math.random() * 2000000),
        date: baseDate,
        category: ['oldPhotos', 'allPhotos'],
        isOld: true,
      })
    }

    // Generate additional all-photos entries
    for (let i = 0; i < 30; i++) {
      const idx = i % demoImages.length
      const baseDate = now - Math.floor(Math.random() * 365) * dayMs
      photos.push({
        id: `photo-${i}`,
        name: `IMG_${6000 + i}.jpg`,
        url: demoImages[idx],
        size: 1000000 + Math.floor(Math.random() * 4000000),
        date: baseDate,
        category: ['allPhotos'],
      })
    }

    set({ photos, scanComplete: true })
  },
}))
