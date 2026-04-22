'use client'

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import {
  Copy, Monitor, User, Video, Layers, Droplet, Sparkles, Clock,
  Trash2, ChevronLeft, ChevronRight, Check, X, Scan, Zap,
  HardDrive, AlertTriangle, RotateCcw, Hand, Sparkle, CircleCheck, Camera,
  Shield, FolderOpen
} from 'lucide-react'
import { usePhotoStore, CATEGORY_CONFIG, type Photo } from '../store/photoStore'

// ─── Utility Functions ────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB'
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return bytes + ' B'
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

const iconMap: Record<string, React.ElementType> = {
  Copy, Monitor, User, Video, Layers, Droplet, Sparkles, Clock, HardDrive,
}

// ─── Native MediaScanner Plugin Interface ─────────────────────
interface NativePhoto {
  id: string
  name: string
  size: number
  date: number
  width: number
  height: number
  filePath: string
  contentUri: string
  type: 'image' | 'video'
  mimeType: string
  duration?: number
}

interface MediaScannerPlugin {
  checkPermissions(): Promise<{ granted: boolean }>
  requestPermissions(): Promise<{ granted: boolean }>
  scanPhotos(): Promise<{ photos: NativePhoto[]; totalCount: number }>
  getThumbnail(options: { contentUri: string; size?: number }): Promise<{ thumbnail: string }>
  getThumbnailsBatch(options: { contentUris: string[]; size?: number }): Promise<{ thumbnails: Array<{ contentUri: string; thumbnail: string }> }>
  deletePhotos(options: { contentUris: string[] }): Promise<{ deleted: number; failed: number; userCancelled?: boolean; error?: string }>
}

type DeleteResult = { deleted: number; failed: number; userCancelled?: boolean; error?: string; timeout?: boolean }

// ─── Delete Confirmation Dialog ───────────────────────────────
function DeleteConfirmDialog({ count, onConfirm, onCancel }: {
  count: number; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center ios-backdrop" onClick={onCancel}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#1c1c1e] rounded-2xl w-[270px] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-white text-lg font-semibold mb-1">Delete {count} Item{count > 1 ? 's' : ''}?</h3>
          <p className="text-[#8e8e93] text-sm">This action cannot be undone.</p>
        </div>
        <div className="border-t border-[#38383a]">
          <button onClick={onCancel}
            className="w-full py-3.5 text-center text-[#0a84ff] text-lg font-normal border-b border-[#38383a] ios-press">Cancel</button>
          <button onClick={onConfirm}
            className="w-full py-3.5 text-center text-[#ff453a] text-lg font-semibold ios-press">Delete</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Storage Ring Component ───────────────────────────────────
function StorageRing({ used, total, size = 160 }: { used: number; total: number; size?: number }) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#2c2c2e" strokeWidth="8" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="url(#greenGrad)"
          strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset} className="animate-draw-ring" />
        <defs>
          <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#30d158" /><stop offset="100%" stopColor="#34c759" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white text-2xl font-bold">{percentage.toFixed(0)}%</span>
        <span className="text-[#8e8e93] text-xs">Used</span>
      </div>
    </div>
  )
}

// ─── Thumbnail Image with Lazy Loading ────────────────────────
function ThumbnailImage({ photo, className }: { photo: Photo; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (photo.thumbnailLoaded || photo.url) {
      setLoaded(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loaded && !error) {
          loadThumbnail(photo)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    )

    if (imgRef.current) observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [photo.contentUri, photo.thumbnailLoaded])

  const loadThumbnail = async (p: Photo) => {
    if (!p.contentUri) { setError(true); return }
    try {
      const { registerPlugin } = await import('@capacitor/core')
      const MediaScanner = registerPlugin<MediaScannerPlugin>('MediaScanner')
      const result = await MediaScanner.getThumbnail({ contentUri: p.contentUri, size: 200 })
      const store = usePhotoStore.getState()
      store.updatePhotoThumbnail(p.contentUri, result.thumbnail)
      setLoaded(true)
    } catch {
      setError(true)
    }
  }

  if (error || (!photo.url && !photo.thumbnailLoaded)) {
    return (
      <div ref={imgRef} className={`${className || ''} bg-[#2c2c2e] flex items-center justify-center`}>
        <Camera className="w-6 h-6 text-[#48484a]" />
      </div>
    )
  }

  return (
    <div ref={imgRef} className={className}>
      {loaded && photo.url ? (
        <img
          src={photo.url}
          alt={photo.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setError(true)}
        />
      ) : (
        <div className="w-full h-full bg-[#2c2c2e] shimmer flex items-center justify-center">
          <Camera className="w-6 h-6 text-[#48484a]" />
        </div>
      )}
    </div>
  )
}

// ─── Photo Card Component ─────────────────────────────────────
function PhotoCard({ photo, isSelected, onToggle, onDelete, selectionMode }: {
  photo: Photo; isSelected: boolean; onToggle: () => void; onDelete: () => void; selectionMode: boolean
}) {
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, y: -20 }} transition={{ duration: 0.25 }} className="relative group">
      <div className={`relative rounded-xl overflow-hidden aspect-square cursor-pointer ios-press ${
          isSelected ? 'ring-2 ring-[#30d158] ring-offset-2 ring-offset-black' : ''}`}
        onClick={selectionMode ? onToggle : undefined}>
        <ThumbnailImage photo={photo} className="w-full h-full" />
        {selectionMode && (
          <div className="absolute top-2 left-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isSelected ? 'bg-[#30d158]' : 'bg-black/50 border border-white/30'}`}>
              {isSelected && <Check className="w-4 h-4 text-white" />}
            </div>
          </div>
        )}
        {!selectionMode && (
          <button onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="absolute top-2 right-2 p-1.5 bg-red-500/70 rounded-full opacity-0 group-active:opacity-100 transition-opacity">
            <Trash2 className="w-3 h-3 text-white" />
          </button>
        )}
      </div>
      <div className="mt-0.5 px-0.5">
        <p className="text-[#8e8e93] text-[9px] truncate">{photo.name}</p>
        <p className="text-[#8e8e93] text-[9px]">{formatSize(photo.size)}</p>
      </div>
    </motion.div>
  )
}

// ─── Swipe Card Component ─────────────────────────────────────
function SwipeCard({ photo, onSwipe, isTop }: {
  photo: Photo; onSwipe: (direction: 'left' | 'right') => void; isTop: boolean
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-15, 15])
  const leftOpacity = useTransform(x, [-100, 0], [1, 0])
  const rightOpacity = useTransform(x, [0, 100], [0, 1])

  return (
    <motion.div className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate, zIndex: isTop ? 10 : 5 }}
      drag={isTop ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7}
      onDragEnd={(_: never, info: PanInfo) => {
        if (info.offset.x > 80) onSwipe('right')
        else if (info.offset.x < -80) onSwipe('left')
      }}
      initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.5 }}
      animate={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.5 }}>
      <div className="w-full h-full rounded-2xl overflow-hidden bg-[#1c1c1e] shadow-2xl">
        <ThumbnailImage photo={photo} className="w-full h-[70%]" />
        <div className="p-4">
          <h3 className="text-white font-semibold text-lg truncate">{photo.name}</h3>
          <p className="text-[#8e8e93] text-sm mt-1">{formatSize(photo.size)} · {formatDate(photo.date)}</p>
        </div>
      </div>
      <motion.div style={{ opacity: leftOpacity }}
        className="absolute top-8 left-8 bg-red-500/80 rounded-xl px-4 py-2 -rotate-12">
        <span className="text-white font-bold text-lg">DELETE</span>
      </motion.div>
      <motion.div style={{ opacity: rightOpacity }}
        className="absolute top-8 right-8 bg-green-500/80 rounded-xl px-4 py-2 rotate-12">
        <span className="text-white font-bold text-lg">KEEP</span>
      </motion.div>
    </motion.div>
  )
}

// ─── Categorize a Native Photo ────────────────────────────────
function categorizeNativePhoto(np: NativePhoto): Photo {
  const categories: string[] = []
  const name = np.name.toLowerCase()

  // Screenshot detection
  if (name.includes('screenshot') || name.includes('scr_') || name.includes('screen shot') ||
      name.includes('screencapture') || name.includes('screen_capture') ||
      name.startsWith('scr-') || name.includes('screen_')) {
    categories.push('screenshots')
  }
  // Also check aspect ratio for screenshots
  if (np.width && np.height) {
    const ratio = Math.max(np.width, np.height) / Math.min(np.width, np.height)
    const screenRatios = [16/9, 18/9, 19.5/9, 20/9, 19/9, 17/9]
    for (const sr of screenRatios) {
      if (Math.abs(ratio - sr) < 0.05) {
        if (!categories.includes('screenshots')) categories.push('screenshots')
        break
      }
    }
  }

  // Selfie detection
  if (name.includes('selfie') || name.includes('self_') || name.includes('front_') ||
      name.includes('portrait') || name.startsWith('img_selfie') || name.startsWith('img_front')) {
    categories.push('selfies')
  }

  // Video detection
  if (np.type === 'video') {
    categories.push('videos')
  }

  // Large files (> 10MB)
  if (np.size > 10 * 1024 * 1024) {
    categories.push('largeFiles')
  }

  // Old photos (> 1 year)
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
  if (np.date < oneYearAgo) {
    categories.push('oldPhotos')
  }

  return {
    id: np.id,
    name: np.name,
    url: '', // Will be loaded as thumbnail on demand
    size: np.size,
    date: np.date,
    category: categories,
    width: np.width,
    height: np.height,
    isScreenshot: categories.includes('screenshots'),
    isSelfie: categories.includes('selfies'),
    isVideo: categories.includes('videos'),
    isLarge: categories.includes('largeFiles'),
    isOld: categories.includes('oldPhotos'),
    nativePath: np.filePath,
    contentUri: np.contentUri,
    photoType: np.type,
    mimeType: np.mimeType,
    analyzed: false, // Will be analyzed for blur/duplicates in background
    thumbnailLoaded: false,
  }
}

// ─── Main App ─────────────────────────────────────────────────
export default function CleanupApp() {
  const store = usePhotoStore()
  const [selectionMode, setSelectionMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [swipeIndex, setSwipeIndex] = useState(0)
  const [scanProgress, setScanProgress] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const [permissionDenied, setPermissionDenied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Detect native platform on mount
  useEffect(() => {
    const checkNative = async () => {
      try {
        const { registerPlugin, Capacitor } = await import('@capacitor/core')
        const native = Capacitor.isNativePlatform()
        store.setIsNative(native)
        if (native) {
          const MediaScanner = registerPlugin<MediaScannerPlugin>('MediaScanner')
          const perm = await MediaScanner.checkPermissions()
          store.setHasPermission(perm.granted)
        }
      } catch {
        store.setIsNative(false)
      }
    }
    checkNative()
  }, [])

  const categoryPhotos = useMemo(() => {
    if (!store.activeCategory) return []
    return store.getPhotosByCategory(store.activeCategory)
  }, [store.activeCategory, store.photos])

  const categoryStats = useMemo(() => store.getCategoryStats(), [store.photos])
  const totalSize = useMemo(() => store.getTotalSize(), [store.photos])
  const selectedSize = useMemo(() => store.getSelectedSize(), [store.photos, store.selectedPhotos])
  const totalDeviceSize = 128 * 1073741824

  // ─── Native Scan Handler ─────────────────────────────────
  const startNativeScan = useCallback(async () => {
    try {
      const { registerPlugin } = await import('@capacitor/core')
      const MediaScanner = registerPlugin<MediaScannerPlugin>('MediaScanner')

      // Step 1: Request permissions
      setScanStatus('Requesting permissions...')
      setScanProgress(5)
      setIsScanning(true)
      store.setScanPhase('requesting')

      const permResult = await MediaScanner.requestPermissions()
      if (!permResult.granted) {
        setPermissionDenied(true)
        setIsScanning(false)
        store.setScanPhase('idle')
        return
      }
      store.setHasPermission(true)
      setPermissionDenied(false)

      // Step 2: Scan all photos
      setScanStatus('Scanning device photos...')
      setScanProgress(15)
      store.setScanPhase('scanning')

      const scanResult = await MediaScanner.scanPhotos()
      const totalFound = scanResult.totalCount

      setScanStatus(`Found ${totalFound} photos. Categorizing...`)
      setScanProgress(40)
      store.setScanPhase('categorizing')
      store.setTotalFound(totalFound)

      // Step 3: Categorize all photos (fast - metadata only)
      const photos: Photo[] = scanResult.photos.map((np: NativePhoto) => categorizeNativePhoto(np))
      store.setPhotos(photos)

      setScanProgress(60)
      setScanStatus('Analysis complete!')

      // Step 4: Background analysis for blur and duplicates
      store.setScanPhase('analyzing')
      setScanStatus('Analyzing for blurry photos...')
      setScanProgress(70)

      // Analyze blurry photos (load thumbnails and check blur)
      const imagePhotos = photos.filter(p => p.photoType === 'image')
      let analyzedCount = 0
      const BLUR_BATCH_SIZE = 20

      for (let i = 0; i < imagePhotos.length; i += BLUR_BATCH_SIZE) {
        const batch = imagePhotos.slice(i, i + BLUR_BATCH_SIZE)

        // Load thumbnails for blur analysis
        const contentUris = batch.map(p => p.contentUri).filter(Boolean) as string[]
        if (contentUris.length > 0) {
          try {
            const thumbResult = await MediaScanner.getThumbnailsBatch({ contentUris, size: 64 })
            for (const item of thumbResult.thumbnails) {
              // Simple blur check: small thumbnail = less detail = potentially blurry
              const photo = batch.find(p => p.contentUri === item.contentUri)
              if (photo && item.thumbnail) {
                // Use canvas-based blur detection
                const blurScore = await detectBlurFromDataUrl(item.thumbnail)
                const updates: Partial<Photo> = { analyzed: true }

                if (blurScore < 50 && !photo.category.includes('blurry')) {
                  updates.isBlurry = true
                  updates.blurScore = blurScore
                  updates.category = [...photo.category, 'blurry']
                } else {
                  updates.blurScore = blurScore
                }

                store.updatePhoto(photo.id, updates)
              }
            }
          } catch {
            // Skip this batch if thumbnail loading fails
          }
        }

        analyzedCount += batch.length
        const progress = 70 + (analyzedCount / imagePhotos.length) * 20
        setScanProgress(Math.round(progress))
        setScanStatus(`Analyzing photos... ${analyzedCount}/${imagePhotos.length}`)
        store.setAnalyzedCount(analyzedCount)
      }

      // Step 5: Find duplicates using image hashing
      setScanProgress(92)
      setScanStatus('Finding duplicates...')
      const allPhotos = usePhotoStore.getState().photos
      const imageHashes: { id: string; hash: string }[] = []

      // Compute simple hash from thumbnails for duplicate detection
      for (let i = 0; i < Math.min(allPhotos.length, 500); i += 20) {
        const batch = allPhotos.slice(i, i + 20)
        const uris = batch.map(p => p.contentUri).filter(Boolean) as string[]
        if (uris.length > 0) {
          try {
            const thumbResult = await MediaScanner.getThumbnailsBatch({ contentUris: uris, size: 8 })
            for (const item of thumbResult.thumbnails) {
              const photo = batch.find(p => p.contentUri === item.contentUri)
              if (photo && item.thumbnail) {
                const hash = await computeSimpleHash(item.thumbnail)
                imageHashes.push({ id: photo.id, hash })
              }
            }
          } catch { /* skip */ }
        }
      }

      // Find duplicates from hashes
      const { duplicateIds, similarIds } = findDuplicatesAndSimilar(imageHashes)
      for (const photo of allPhotos) {
        if (duplicateIds.has(photo.id) && !photo.category.includes('duplicates')) {
          store.updatePhoto(photo.id, {
            isDuplicate: true,
            category: [...photo.category, 'duplicates']
          })
        }
        if (similarIds.has(photo.id) && !photo.category.includes('similar')) {
          store.updatePhoto(photo.id, {
            isSimilar: true,
            category: [...photo.category, 'similar']
          })
        }
      }

      // Done!
      setScanProgress(100)
      setScanStatus('Scan complete!')
      store.setScanComplete(true)
      store.setScanPhase('done')

      setTimeout(() => {
        setIsScanning(false)
      }, 800)

    } catch (err) {
      console.error('Scan error:', err)
      setIsScanning(false)
      store.setScanPhase('idle')
      setScanStatus('Scan failed. Please try again.')
    }
  }, [store])

  // ─── Web Fallback Scan ─────────────────────────────────
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsScanning(true)
    store.setLoading(true)
    store.setScanPhase('scanning')

    try {
      const total = Math.min(files.length, store.maxPhotos - store.photos.length)
      const newPhotos: Photo[] = []

      for (let i = 0; i < total; i++) {
        const file = files[i]
        setScanProgress(Math.round(((i + 1) / total) * 80))
        setScanStatus(`Reading ${file.name}...`)

        const dataUrl = await fileToDataURL(file)
        const categories: string[] = []
        const name = file.name.toLowerCase()

        if (name.includes('screenshot') || name.includes('scr_')) categories.push('screenshots')
        if (name.includes('selfie') || name.includes('front_')) categories.push('selfies')
        if (['mp4', 'mov', 'avi', 'mkv'].includes(name.split('.').pop() || '')) categories.push('videos')
        if (file.size > 10 * 1024 * 1024) categories.push('largeFiles')
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
        if ((file.lastModified || Date.now()) < oneYearAgo) categories.push('oldPhotos')

        newPhotos.push({
          id: `web-${Date.now()}-${i}`,
          name: file.name,
          url: dataUrl,
          size: file.size,
          date: file.lastModified || Date.now(),
          category: categories,
          photoType: categories.includes('videos') ? 'video' : 'image',
          thumbnailLoaded: true,
          analyzed: false,
        })
      }

      store.addPhotos(newPhotos)
      store.setScanComplete(true)
      store.setScanPhase('done')
      setScanProgress(100)
      setScanStatus('Done!')
    } catch (err) {
      console.error('File select error:', err)
    } finally {
      setIsScanning(false)
      store.setLoading(false)
      setScanStatus('')
    }
  }, [store])

  // ─── Start Scan (chooses native or web) ─────────────────
  const startScan = useCallback(() => {
    if (store.isNative) {
      startNativeScan()
    } else {
      // Web fallback
      fileInputRef.current?.click()
    }
  }, [store.isNative, startNativeScan])

  // ─── Delete Handler ──────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (store.selectedPhotos.size === 0) return
    setShowDeleteConfirm(true)
  }, [store.selectedPhotos])

  const confirmDelete = useCallback(async () => {
    const ids = Array.from(store.selectedPhotos)
    if (ids.length === 0) return

    // Get contentUris for native deletion BEFORE removing from state
    const photosToDelete = store.photos.filter(p => ids.includes(p.id))
    const contentUris = photosToDelete.map(p => p.contentUri).filter(Boolean) as string[]

    setShowDeleteConfirm(false)

    // Actually delete files from device FIRST (before UI update)
    if (store.isNative && contentUris.length > 0) {
      try {
        const { registerPlugin } = await import('@capacitor/core')
        const MediaScanner = registerPlugin<MediaScannerPlugin>('MediaScanner')

        // Add a timeout wrapper - if native delete hangs, resolve after 25 seconds
        const deletePromise = MediaScanner.deletePhotos({ contentUris })
        const timeoutPromise = new Promise<DeleteResult>((resolve) => {
          setTimeout(() => resolve({ deleted: 0, failed: contentUris.length, timeout: true }), 25000)
        })

        const result: DeleteResult = await Promise.race([deletePromise, timeoutPromise])

        if (result.userCancelled) {
          // User cancelled the system dialog - don't remove from UI
          return
        }

        if (result.timeout) {
          // Timeout - still remove from UI as the system dialog may have completed
          console.warn('Native delete timed out, removing from UI anyway')
          store.deletePhotos(ids)
          store.clearSelection()
          setSelectionMode(false)
          return
        }

        // Remove from UI regardless - the system dialog handles the actual deletion
        // Even if some files failed, the user already confirmed they want to delete
        if (result.deleted > 0 || !result.userCancelled) {
          store.deletePhotos(ids)
          store.clearSelection()
          setSelectionMode(false)
        }
      } catch (err) {
        console.error('Native delete failed:', err)
        // Still remove from UI even if native delete throws an error
        store.deletePhotos(ids)
        store.clearSelection()
        setSelectionMode(false)
      }
    } else {
      // Web fallback - just remove from state
      store.deletePhotos(ids)
      store.clearSelection()
      setSelectionMode(false)
    }
  }, [store])

  // ─── Delete Single Photo (real deletion) ───────────────────
  const deleteSinglePhoto = useCallback(async (photo: Photo) => {
    if (store.isNative && photo.contentUri) {
      try {
        const { registerPlugin } = await import('@capacitor/core')
        const MediaScanner = registerPlugin<MediaScannerPlugin>('MediaScanner')

        // Add timeout wrapper
        const deletePromise = MediaScanner.deletePhotos({ contentUris: [photo.contentUri] })
        const timeoutPromise = new Promise<DeleteResult>((resolve) => {
          setTimeout(() => resolve({ deleted: 0, failed: 1, timeout: true }), 25000)
        })

        const result: DeleteResult = await Promise.race([deletePromise, timeoutPromise])

        if (result.userCancelled) return // Don't remove from UI

        // Remove from UI - user confirmed deletion in our dialog already
        store.deletePhotos([photo.id])
      } catch (err) {
        console.error('Native delete failed:', err)
        store.deletePhotos([photo.id]) // Fallback: still remove from UI
      }
    } else {
      store.deletePhotos([photo.id])
    }
  }, [store])

  // ─── Swipe Handlers ─────────────────────────────────────
  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    if (direction === 'left') {
      const photos = store.getPhotosByCategory(store.activeCategory || 'duplicates')
      const currentPhoto = photos[swipeIndex]
      if (currentPhoto) {
        // Delete from device first
        if (store.isNative && currentPhoto.contentUri) {
          try {
            const { registerPlugin } = await import('@capacitor/core')
            const MediaScanner = registerPlugin<MediaScannerPlugin>('MediaScanner')

            const deletePromise = MediaScanner.deletePhotos({ contentUris: [currentPhoto.contentUri] })
            const timeoutPromise = new Promise<DeleteResult>((resolve) => {
              setTimeout(() => resolve({ deleted: 0, failed: 1, timeout: true }), 25000)
            })

            const result: DeleteResult = await Promise.race([deletePromise, timeoutPromise])
            if (!result.userCancelled) {
              store.deletePhotos([currentPhoto.id])
            }
          } catch (err) {
            console.error('Native delete failed:', err)
            store.deletePhotos([currentPhoto.id])
          }
        } else {
          store.deletePhotos([currentPhoto.id])
        }
      }
    }
    setSwipeIndex(prev => prev + 1)
  }, [store, swipeIndex])

  // ─── Render: Scanning Screen ────────────────────────────
  if (isScanning) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-24 h-24 mb-8">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#2c2c2e" strokeWidth="6" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="#30d158" strokeWidth="6"
              strokeLinecap="round" strokeDasharray={`${scanProgress * 2.51} 251`}
              className="transition-all duration-200" />
          </svg>
        </motion.div>
        <h2 className="text-white text-2xl font-bold mb-2">Scanning Device...</h2>
        <p className="text-[#8e8e93] text-center mb-4">{scanStatus || 'Reading your photos'}</p>
        <div className="w-64 h-1.5 bg-[#2c2c2e] rounded-full overflow-hidden">
          <motion.div className="h-full bg-[#30d158] rounded-full" style={{ width: `${scanProgress}%` }} />
        </div>
        <p className="text-[#30d158] text-sm mt-3 font-medium">{Math.round(scanProgress)}%</p>
      </div>
    )
  }

  // ─── Render: Permission Denied ──────────────────────────
  if (permissionDenied && store.isNative) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-white text-2xl font-bold mb-3">Permission Required</h2>
          <p className="text-[#8e8e93] text-base mb-6 max-w-xs mx-auto">
            Cleanup needs access to your photos and videos to scan for clutter. Please grant permission to continue.
          </p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setPermissionDenied(false); startNativeScan() }}
            className="w-full max-w-xs mx-auto bg-[#30d158] text-white font-semibold text-lg py-4 rounded-2xl shadow-lg shadow-green-500/30 ios-press">
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-5 h-5" />
              <span>Grant Permission</span>
            </div>
          </motion.button>
          <button onClick={() => setPermissionDenied(false)}
            className="text-[#8e8e93] text-sm mt-4">Cancel</button>
        </motion.div>
      </div>
    )
  }

  // ─── Render: Welcome Screen ─────────────────────────────
  if (store.currentScreen === 'home' && !store.scanComplete) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 safe-top safe-bottom">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-center">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[#30d158] to-[#28a745] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20 overflow-hidden">
            <img src="/logo.png" alt="Cleanup" className="w-full h-full object-cover rounded-3xl" />
          </div>
          <h1 className="text-white text-4xl font-bold mb-3">Cleanup</h1>
          <p className="text-[#8e8e93] text-lg mb-8 max-w-xs mx-auto">
            Scan your device and reclaim storage space in seconds
          </p>

          <motion.button whileTap={{ scale: 0.97 }} onClick={startScan}
            className="w-full max-w-xs mx-auto bg-[#30d158] text-white font-semibold text-lg py-4 rounded-2xl shadow-lg shadow-green-500/30 mb-4 ios-press">
            <div className="flex items-center justify-center gap-2">
              <Scan className="w-5 h-5" />
              <span>Scan My Photos</span>
            </div>
          </motion.button>

          {!store.isNative && (
            <p className="text-[#8e8e93] text-xs mt-6 max-w-xs mx-auto">
              For the best experience, install the Cleanup app on your device. Web version requires manual photo selection.
            </p>
          )}
        </motion.div>

        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)} />
      </div>
    )
  }

  // ─── Render: Results Screen ─────────────────────────────
  if (store.currentScreen === 'results') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 12 }}
            className="w-24 h-24 rounded-full bg-[#30d158]/20 flex items-center justify-center mx-auto mb-6">
            <CircleCheck className="w-12 h-12 text-[#30d158]" />
          </motion.div>
          <h2 className="text-white text-3xl font-bold mb-2">All Clean!</h2>
          <p className="text-[#8e8e93] text-lg mb-8">Your device is optimized</p>
          <button onClick={() => { store.reset() }}
            className="bg-[#30d158] text-white font-semibold px-8 py-4 rounded-2xl ios-press">
            <div className="flex items-center gap-2"><RotateCcw className="w-5 h-5" /><span>Scan Again</span></div>
          </button>
        </motion.div>
      </div>
    )
  }

  // ─── Render: Category Gallery ───────────────────────────
  if (store.currentScreen === 'category' && store.activeCategory) {
    const activeConfig = CATEGORY_CONFIG.find(c => c.id === store.activeCategory)
    return (
      <div className="min-h-screen bg-black flex flex-col h-screen">
        <div className="flex items-center px-4 py-3 border-b border-[#38383a] ios-backdrop sticky top-0 z-20 shrink-0">
          <button onClick={() => { store.setActiveCategory(null); store.setScreen('home'); store.clearSelection(); setSelectionMode(false) }}
            className="p-2 ios-press"><ChevronLeft className="w-6 h-6 text-[#0a84ff]" /></button>
          <div className="flex-1 text-center">
            <h1 className="text-white text-lg font-semibold">{activeConfig?.name || 'Photos'}</h1>
            <p className="text-[#8e8e93] text-xs">{categoryPhotos.length} items · {formatSize(categoryPhotos.reduce((a, p) => a + p.size, 0))}</p>
          </div>
          <button onClick={() => { setSelectionMode(!selectionMode); if (selectionMode) store.clearSelection() }}
            className={`p-2 ios-press rounded-lg ${selectionMode ? 'bg-[#30d158]/20 text-[#30d158]' : 'text-[#0a84ff]'}`}>
            <Check className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {selectionMode && store.selectedPhotos.size > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-[#1c1c1e] border-b border-[#38383a]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[#30d158] font-medium">{store.selectedPhotos.size} selected · {formatSize(selectedSize)}</span>
                <div className="flex gap-3">
                  <button onClick={() => store.selectAll(categoryPhotos.map(p => p.id))} className="text-[#0a84ff] text-sm font-medium ios-press">Select All</button>
                  <button onClick={handleDelete} className="text-[#ff453a] text-sm font-semibold ios-press">Delete</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto overscroll-contain p-3" style={{ paddingBottom: selectionMode ? 100 : 80, WebkitOverflowScrolling: 'touch' }}>
          {categoryPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Sparkle className="w-16 h-16 text-[#38383a] mb-4" />
              <p className="text-[#8e8e93] text-lg">No photos in this category</p>
            </div>
          ) : (
            <motion.div className="grid grid-cols-3 gap-1.5" layout>
              <AnimatePresence mode="popLayout">
                {categoryPhotos.map((photo) => (
                  <PhotoCard key={photo.id} photo={photo} isSelected={store.selectedPhotos.has(photo.id)}
                    onToggle={() => store.toggleSelect(photo.id)} onDelete={() => deleteSinglePhoto(photo)}
                    selectionMode={selectionMode} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {selectionMode && (
          <div className="fixed bottom-0 left-0 right-0 ios-backdrop border-t border-[#38383a] safe-bottom z-30">
            <div className="flex items-center justify-around py-3 px-4">
              <button onClick={() => { store.clearSelection(); setSelectionMode(false) }} className="flex flex-col items-center gap-1 ios-press">
                <X className="w-5 h-5 text-[#8e8e93]" /><span className="text-[#8e8e93] text-[10px]">Cancel</span>
              </button>
              <button onClick={handleDelete} className="flex flex-col items-center gap-1 ios-press">
                <div className="w-12 h-12 rounded-full bg-[#ff453a] flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-[#ff453a] text-[10px] font-medium">Delete ({store.selectedPhotos.size})</span>
              </button>
              <button onClick={() => store.selectAll(categoryPhotos.map(p => p.id))} className="flex flex-col items-center gap-1 ios-press">
                <Check className="w-5 h-5 text-[#30d158]" /><span className="text-[#30d158] text-[10px]">Select All</span>
              </button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showDeleteConfirm && <DeleteConfirmDialog count={store.selectedPhotos.size} onConfirm={confirmDelete} onCancel={() => setShowDeleteConfirm(false)} />}
        </AnimatePresence>
      </div>
    )
  }

  // ─── Render: Swipe Mode ─────────────────────────────────
  if (store.currentScreen === 'swipe') {
    const swipePhotos = store.getPhotosByCategory(store.activeCategory || 'duplicates')
    const currentPhoto = swipePhotos[swipeIndex]
    return (
      <div className="min-h-screen bg-black flex flex-col h-screen">
        <div className="flex items-center px-4 py-3 border-b border-[#38383a] shrink-0">
          <button onClick={() => { store.setScreen('home'); setSwipeIndex(0) }} className="p-2 ios-press">
            <ChevronLeft className="w-6 h-6 text-[#0a84ff]" /></button>
          <div className="flex-1 text-center">
            <h1 className="text-white text-lg font-semibold">Swipe to Clean</h1>
            <p className="text-[#8e8e93] text-xs">{swipeIndex} of {swipePhotos.length} reviewed</p>
          </div>
          <div className="w-10" />
        </div>
        <div className="flex-1 relative px-4 py-6">
          {!currentPhoto ? (
            <div className="flex flex-col items-center justify-center h-full">
              <CircleCheck className="w-16 h-16 text-[#30d158] mb-4" />
              <h2 className="text-white text-2xl font-bold mb-2">All Done!</h2>
              <button onClick={() => { store.setScreen('home'); setSwipeIndex(0) }}
                className="bg-[#30d158] text-white font-semibold px-6 py-3 rounded-xl ios-press">Back to Home</button>
            </div>
          ) : (
            <>
              <div className="relative w-full h-[70vh]">
                {swipePhotos.slice(swipeIndex, swipeIndex + 2).reverse().map((photo, i, arr) => (
                  <SwipeCard key={photo.id} photo={photo} onSwipe={handleSwipe} isTop={i === arr.length - 1} />
                ))}
              </div>
              <div className="flex items-center justify-center gap-8 mt-6">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleSwipe('left')}
                  className="w-16 h-16 rounded-full bg-[#ff453a]/20 flex items-center justify-center ios-press">
                  <X className="w-8 h-8 text-[#ff453a]" /></motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleSwipe('right')}
                  className="w-16 h-16 rounded-full bg-[#30d158]/20 flex items-center justify-center ios-press">
                  <Check className="w-8 h-8 text-[#30d158]" /></motion.button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── Render: Smart Clean ────────────────────────────────
  if (store.currentScreen === 'smartClean') {
    const cleanablePhotos = categoryStats.filter(c => c.count > 0).sort((a, b) => b.size - a.size)
    const totalCleanable = cleanablePhotos.reduce((a, c) => a + c.size, 0)
    const totalCleanableCount = cleanablePhotos.reduce((a, c) => a + c.count, 0)
    return (
      <div className="min-h-screen bg-black flex flex-col h-screen">
        <div className="flex items-center px-4 py-3 border-b border-[#38383a] shrink-0">
          <button onClick={() => store.setScreen('home')} className="p-2 ios-press">
            <ChevronLeft className="w-6 h-6 text-[#0a84ff]" /></button>
          <h1 className="text-white text-lg font-semibold flex-1 text-center">Smart Clean</h1>
          <div className="w-10" />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4" style={{ paddingBottom: 100, WebkitOverflowScrolling: 'touch' }}>
          <div className="text-center mb-6">
            <div className="text-[#30d158] text-4xl font-bold mb-1">{formatSize(totalCleanable)}</div>
            <p className="text-[#8e8e93]">Can be freed up</p>
            <p className="text-[#8e8e93] text-sm">{totalCleanableCount} items found</p>
          </div>
          {cleanablePhotos.map((cat, idx) => {
            const Icon = iconMap[cat.icon] || Layers
            return (
              <motion.div key={cat.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }} className="bg-[#1c1c1e] rounded-2xl p-4 mb-3 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: cat.color + '20' }}>
                  <Icon className="w-6 h-6" style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-white font-semibold">{cat.name}</h3>
                    <span className="text-[#8e8e93] text-sm">{formatSize(cat.size)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8e8e93] text-sm">{cat.count} items</span>
                    <button onClick={() => { store.setActiveCategory(cat.id); store.setScreen('category') }}
                      className="text-[#0a84ff] text-sm font-medium ios-press">Review →</button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 ios-backdrop safe-bottom z-20">
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => {
              store.selectAll(cleanablePhotos.flatMap(cat => store.getPhotosByCategory(cat.id).map(p => p.id)))
              setShowDeleteConfirm(true)
            }}
            className="w-full bg-[#ff453a] text-white font-semibold text-lg py-4 rounded-2xl ios-press">
            Delete All ({totalCleanableCount} items · {formatSize(totalCleanable)})
          </motion.button>
        </div>
        <AnimatePresence>
          {showDeleteConfirm && <DeleteConfirmDialog count={store.selectedPhotos.size}
            onConfirm={async () => {
              const ids = Array.from(store.selectedPhotos)
              const photosToDelete = store.photos.filter(p => ids.includes(p.id))
              const contentUris = photosToDelete.map(p => p.contentUri).filter(Boolean) as string[]
              setShowDeleteConfirm(false)
              if (store.isNative && contentUris.length > 0) {
                try {
                  const { registerPlugin } = await import('@capacitor/core')
                  const MediaScanner = registerPlugin<MediaScannerPlugin>('MediaScanner')

                  const deletePromise = MediaScanner.deletePhotos({ contentUris })
                  const timeoutPromise = new Promise<DeleteResult>((resolve) => {
                    setTimeout(() => resolve({ deleted: 0, failed: contentUris.length, timeout: true }), 25000)
                  })

                  const result: DeleteResult = await Promise.race([deletePromise, timeoutPromise])
                  if (!result.userCancelled) {
                    store.deletePhotos(ids)
                    store.clearSelection()
                  }
                } catch (err) {
                  console.error('Native delete failed:', err)
                  store.deletePhotos(ids)
                  store.clearSelection()
                }
              } else {
                store.deletePhotos(ids)
                store.clearSelection()
              }
            }}
            onCancel={() => { store.clearSelection(); setShowDeleteConfirm(false) }} />}
        </AnimatePresence>
      </div>
    )
  }

  // ─── Render: Home Dashboard ─────────────────────────────
  const activeCategories = categoryStats.filter(c => c.count > 0)
  const totalCleanableSize = activeCategories.reduce((a, c) => a + c.size, 0)

  return (
    <div className="min-h-screen bg-black flex flex-col h-screen">
      {/* Header */}
      <div className="px-4 pt-12 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-[#30d158] to-[#28a745] flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Cleanup" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold">Cleanup</h1>
            <p className="text-[#8e8e93] text-xs">{store.photos.length} photos · {formatSize(totalSize)} used</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4" style={{ paddingBottom: 80, WebkitOverflowScrolling: 'touch' }}>
        {/* Storage Ring */}
        <div className="flex justify-center py-4">
          <StorageRing used={totalSize} total={totalDeviceSize} size={160} />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => { store.setActiveCategory('duplicates'); store.setScreen('swipe'); setSwipeIndex(0) }}
            className="bg-[#1c1c1e] rounded-2xl p-4 text-left ios-press">
            <Hand className="w-6 h-6 text-[#0a84ff] mb-2" />
            <h3 className="text-white font-semibold text-sm">Swipe Clean</h3>
            <p className="text-[#8e8e93] text-xs mt-0.5">Swipe to delete</p>
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => store.setScreen('smartClean')}
            className="bg-[#1c1c1e] rounded-2xl p-4 text-left ios-press">
            <Zap className="w-6 h-6 text-[#ff9f0a] mb-2" />
            <h3 className="text-white font-semibold text-sm">Smart Clean</h3>
            <p className="text-[#8e8e93] text-xs mt-0.5">
              {activeCategories.length > 0 ? `${formatSize(totalCleanableSize)} to free` : 'No items'}
            </p>
          </motion.button>
        </div>

        {/* Rescan Button */}
        <motion.button whileTap={{ scale: 0.97 }} onClick={startScan}
          className="w-full bg-[#30d158]/10 border border-[#30d158]/20 rounded-2xl p-3 mb-4 flex items-center justify-center gap-2 ios-press">
          <Scan className="w-4 h-4 text-[#30d158]" />
          <span className="text-[#30d158] font-medium text-sm">Rescan Device</span>
        </motion.button>

        {/* Categories */}
        <h2 className="text-white text-lg font-semibold mb-3">Categories</h2>
        <div className="space-y-2 mb-6">
          {categoryStats.map((cat, idx) => {
            const Icon = iconMap[cat.icon] || Layers
            return (
              <motion.button key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }} whileTap={{ scale: 0.98 }}
                onClick={() => { store.setActiveCategory(cat.id); store.setScreen('category'); setSelectionMode(false); store.clearSelection() }}
                className="w-full bg-[#1c1c1e] rounded-2xl p-4 flex items-center gap-3 ios-press text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: cat.color + '20' }}>
                  <Icon className="w-5 h-5" style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium">{cat.name}</h3>
                  <p className="text-[#8e8e93] text-xs">{cat.count > 0 ? `${cat.count} items · ${formatSize(cat.size)}` : 'No items'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8e8e93] shrink-0" />
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 ios-backdrop border-t border-[#38383a] safe-bottom z-30">
        <div className="flex items-center justify-around py-2 px-4">
          <button onClick={() => store.setScreen('home')} className="flex flex-col items-center gap-0.5 py-1 ios-press">
            <Sparkle className="w-5 h-5 text-[#30d158]" />
            <span className="text-[#30d158] text-[10px] font-medium">Home</span>
          </button>
          <button onClick={() => { store.setActiveCategory('duplicates'); store.setScreen('swipe'); setSwipeIndex(0) }}
            className="flex flex-col items-center gap-0.5 py-1 ios-press">
            <Hand className="w-5 h-5 text-[#8e8e93]" />
            <span className="text-[#8e8e93] text-[10px]">Swipe</span>
          </button>
          <button onClick={() => store.setScreen('smartClean')} className="flex flex-col items-center gap-0.5 py-1 ios-press">
            <Zap className="w-5 h-5 text-[#8e8e93]" />
            <span className="text-[#8e8e93] text-[10px]">Smart</span>
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)} />

      <AnimatePresence>
        {showDeleteConfirm && <DeleteConfirmDialog count={store.selectedPhotos.size} onConfirm={confirmDelete} onCancel={() => setShowDeleteConfirm(false)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Image Analysis Utilities (Client-side) ───────────────────

function detectBlurFromDataUrl(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 32
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(100); return }

        ctx.drawImage(img, 0, 0, size, size)
        const imageData = ctx.getImageData(0, 0, size, size)
        const gray = new Float32Array(size * size)

        for (let i = 0; i < size * size; i++) {
          const r = imageData.data[i * 4]
          const g = imageData.data[i * 4 + 1]
          const b = imageData.data[i * 4 + 2]
          gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
        }

        let sum = 0, sumSq = 0, count = 0
        for (let y = 1; y < size - 1; y++) {
          for (let x = 1; x < size - 1; x++) {
            const laplacian =
              -4 * gray[y * size + x] +
              gray[(y - 1) * size + x] +
              gray[(y + 1) * size + x] +
              gray[y * size + (x - 1)] +
              gray[y * size + (x + 1)]
            sum += laplacian
            sumSq += laplacian * laplacian
            count++
          }
        }

        const mean = sum / count
        const variance = (sumSq / count) - (mean * mean)
        resolve(variance)
      } catch {
        resolve(100)
      }
    }
    img.onerror = () => resolve(100)
    img.src = dataUrl
  })
}

function computeSimpleHash(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 8
        canvas.height = 8
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve('00000000'); return }

        ctx.drawImage(img, 0, 0, 8, 8)
        const imageData = ctx.getImageData(0, 0, 8, 8)
        const gray: number[] = []

        for (let i = 0; i < 64; i++) {
          const r = imageData.data[i * 4]
          const g = imageData.data[i * 4 + 1]
          const b = imageData.data[i * 4 + 2]
          gray.push(0.299 * r + 0.587 * g + 0.114 * b)
        }

        const avg = gray.reduce((a, b) => a + b, 0) / gray.length
        let hash = ''
        for (let i = 0; i < 64; i++) {
          hash += gray[i] > avg ? '1' : '0'
        }
        resolve(hash)
      } catch {
        resolve('00000000')
      }
    }
    img.onerror = () => resolve('00000000')
    img.src = dataUrl
  })
}

function findDuplicatesAndSimilar(photos: { id: string; hash: string }[]): {
  duplicateIds: Set<string>
  similarIds: Set<string>
} {
  const duplicateIds = new Set<string>()
  const similarIds = new Set<string>()

  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      let dist = 0
      for (let k = 0; k < Math.min(photos[i].hash.length, photos[j].hash.length); k++) {
        if (photos[i].hash[k] !== photos[j].hash[k]) dist++
      }
      if (dist <= 5) {
        duplicateIds.add(photos[i].id)
        duplicateIds.add(photos[j].id)
      } else if (dist <= 15) {
        similarIds.add(photos[i].id)
        similarIds.add(photos[j].id)
      }
    }
  }

  return { duplicateIds, similarIds }
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
