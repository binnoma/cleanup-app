'use client'

import React, { useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import {
  Copy, Monitor, User, Video, Layers, Droplet, Sparkles, Clock,
  Trash2, ChevronLeft, ChevronRight, Check, X, Scan, Zap, Plus,
  HardDrive, AlertTriangle, RotateCcw, Hand, Sparkle, CircleCheck, Camera
} from 'lucide-react'
import { usePhotoStore, CATEGORY_CONFIG, type Photo } from '../store/photoStore'
import {
  analyzePhoto, findDuplicatesAndSimilar, fileToDataURL
} from '../lib/imageAnalysis'

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
        <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" fill="#2c2c2e"><rect width="200" height="200"/><text x="100" y="105" text-anchor="middle" fill="#8e8e93" font-size="12">${photo.name}</text></svg>` )}` }} />
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
        <img src={photo.url} alt={photo.name} className="w-full h-[70%] object-cover" />
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

// ─── Main App ─────────────────────────────────────────────────
export default function CleanupApp() {
  const store = usePhotoStore()
  const [selectionMode, setSelectionMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [swipeIndex, setSwipeIndex] = useState(0)
  const [scanProgress, setScanProgress] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const categoryPhotos = useMemo(() => {
    if (!store.activeCategory) return []
    return store.getPhotosByCategory(store.activeCategory)
  }, [store.activeCategory, store.photos])

  const categoryStats = useMemo(() => store.getCategoryStats(), [store.photos])
  const totalSize = useMemo(() => store.getTotalSize(), [store.photos])
  const selectedSize = useMemo(() => store.getSelectedSize(), [store.photos, store.selectedPhotos])
  const totalDeviceSize = 128 * 1073741824

  // ─── Real Photo Scan ──────────────────────────────────────
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsScanning(true)
    store.setLoading(true)

    try {
      const total = Math.min(files.length, store.maxPhotos - store.photos.length)
      const newPhotos: Photo[] = []
      const hashList: { id: string; hash: string }[] = []

      for (let i = 0; i < total; i++) {
        const file = files[i]
        setScanProgress(Math.round(((i + 1) / total) * 70))
        setScanStatus(`Reading ${file.name}...`)

        // Convert to data URL
        const dataUrl = await fileToDataURL(file)

        // Analyze the photo
        setScanStatus(`Analyzing ${file.name}...`)
        const analysis = await analyzePhoto(dataUrl, file.name, file.size, file.lastModified || Date.now())

        const categories = [...analysis.categories]
        hashList.push({ id: `real-${Date.now()}-${i}`, hash: analysis.hash })

        newPhotos.push({
          id: `real-${Date.now()}-${i}`,
          name: file.name,
          url: dataUrl,
          size: file.size,
          date: file.lastModified || Date.now(),
          category: categories,
          width: analysis.width,
          height: analysis.height,
          isBlurry: categories.includes('blurry'),
          isScreenshot: categories.includes('screenshots'),
          isSelfie: categories.includes('selfies'),
          isVideo: categories.includes('videos'),
          blurScore: analysis.blurScore,
        })
      }

      // Find duplicates and similar
      setScanProgress(75)
      setScanStatus('Finding duplicates...')
      const { duplicateIds, similarIds } = findDuplicatesAndSimilar(hashList)

      // Add duplicate/similar categories
      for (let i = 0; i < newPhotos.length; i++) {
        const photo = newPhotos[i]
        if (duplicateIds.has(photo.id) && !photo.category.includes('duplicates')) {
          photo.category.push('duplicates')
          photo.isDuplicate = true
        }
        if (similarIds.has(photo.id) && !photo.category.includes('similar')) {
          photo.category.push('similar')
          photo.isSimilar = true
        }
      }

      setScanProgress(90)
      setScanStatus('Finalizing...')

      // Add all photos to store
      store.addPhotos(newPhotos)
      store.setScanComplete(true)

      setScanProgress(100)
      setScanStatus('Done!')
    } catch (err) {
      console.error('Scan error:', err)
    } finally {
      setIsScanning(false)
      store.setLoading(false)
      setScanStatus('')
    }
  }, [store])

  // ─── Open Native Photo Picker ────────────────────────────
  const openPhotoPicker = useCallback(async () => {
    // Try native Capacitor Camera first
    try {
      const { Camera: CapCamera, CameraResultType, CameraSource } = await import('@capacitor/camera')

      // Request permissions
      try {
        await CapCamera.requestPermissions({ permissions: ['photos'] })
      } catch { /* permission might already be granted */ }

      const photo = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      })

      // Single photo from native picker - analyze it
      setIsScanning(true)
      setScanStatus('Analyzing photo...')
      setScanProgress(50)

      const dataUrl = photo.dataUrl || ''
      const analysis = await analyzePhoto(dataUrl, `Photo_${Date.now()}.jpg`, Math.round(dataUrl.length * 0.75), Date.now())

      store.addPhotos([{
        id: `cam-${Date.now()}`,
        name: `Photo_${Date.now()}.jpg`,
        url: dataUrl,
        size: Math.round(dataUrl.length * 0.75),
        date: Date.now(),
        category: analysis.categories,
        width: analysis.width,
        height: analysis.height,
        isBlurry: analysis.categories.includes('blurry'),
        isScreenshot: analysis.categories.includes('screenshots'),
        blurScore: analysis.blurScore,
      }])
      store.setScanComplete(true)
      setIsScanning(false)
      setScanProgress(100)
    } catch {
      // Fallback to file input (web or permission denied)
      fileInputRef.current?.click()
    }
  }, [store])

  // ─── Scan Button ─────────────────────────────────────────
  const startScan = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // ─── Delete Handler ──────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (store.selectedPhotos.size === 0) return
    setShowDeleteConfirm(true)
  }, [store.selectedPhotos])

  const confirmDelete = useCallback(() => {
    store.deletePhotos(Array.from(store.selectedPhotos))
    store.clearSelection()
    setShowDeleteConfirm(false)
    setSelectionMode(false)
  }, [store])

  // ─── Swipe Handlers ─────────────────────────────────────
  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (direction === 'left') {
      const photos = store.getPhotosByCategory(store.activeCategory || 'duplicates')
      const currentPhoto = photos[swipeIndex]
      if (currentPhoto) store.deletePhotos([currentPhoto.id])
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
        <h2 className="text-white text-2xl font-bold mb-2">Scanning Photos...</h2>
        <p className="text-[#8e8e93] text-center mb-4">{scanStatus || 'Analyzing your photos'}</p>
        <div className="w-64 h-1.5 bg-[#2c2c2e] rounded-full overflow-hidden">
          <motion.div className="h-full bg-[#30d158] rounded-full" style={{ width: `${scanProgress}%` }} />
        </div>
        <p className="text-[#30d158] text-sm mt-3 font-medium">{Math.round(scanProgress)}%</p>
      </div>
    )
  }

  // ─── Render: Welcome Screen ─────────────────────────────
  if (store.currentScreen === 'home' && !store.scanComplete) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-center">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[#30d158] to-[#28a745] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
            <Sparkle className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-white text-4xl font-bold mb-3">Cleanup</h1>
          <p className="text-[#8e8e93] text-lg mb-8 max-w-xs mx-auto">
            Clean up your device and optimize storage in seconds
          </p>

          <motion.button whileTap={{ scale: 0.97 }} onClick={startScan}
            className="w-full max-w-xs mx-auto bg-[#30d158] text-white font-semibold text-lg py-4 rounded-2xl shadow-lg shadow-green-500/30 mb-4 ios-press">
            <div className="flex items-center justify-center gap-2">
              <Scan className="w-5 h-5" />
              <span>Scan My Photos</span>
            </div>
          </motion.button>

          <motion.button whileTap={{ scale: 0.97 }} onClick={openPhotoPicker}
            className="w-full max-w-xs mx-auto bg-[#1c1c1e] text-[#0a84ff] font-semibold text-base py-3.5 rounded-2xl border border-[#0a84ff]/20 ios-press">
            <div className="flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" />
              <span>Pick from Gallery</span>
            </div>
          </motion.button>

          <p className="text-[#8e8e93] text-xs mt-6">
            Select photos to scan for duplicates, blur, and clutter
          </p>
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
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex items-center px-4 py-3 border-b border-[#38383a] ios-backdrop sticky top-0 z-20">
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

        <div className="flex-1 overflow-y-auto p-3 safe-bottom" style={{ paddingBottom: selectionMode ? 100 : 80 }}>
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
                    onToggle={() => store.toggleSelect(photo.id)} onDelete={() => store.deletePhotos([photo.id])}
                    selectionMode={selectionMode} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {selectionMode && (
          <div className="fixed bottom-0 left-0 right-0 ios-backdrop border-t border-[#38383a] safe-bottom">
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
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex items-center px-4 py-3 border-b border-[#38383a]">
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
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex items-center px-4 py-3 border-b border-[#38383a]">
          <button onClick={() => store.setScreen('home')} className="p-2 ios-press">
            <ChevronLeft className="w-6 h-6 text-[#0a84ff]" /></button>
          <h1 className="text-white text-lg font-semibold flex-1 text-center">Smart Clean</h1>
          <div className="w-10" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 safe-bottom" style={{ paddingBottom: 100 }}>
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
        <div className="fixed bottom-0 left-0 right-0 p-4 ios-backdrop safe-bottom">
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
            onConfirm={() => { store.deletePhotos(Array.from(store.selectedPhotos)); store.clearSelection(); setShowDeleteConfirm(false) }}
            onCancel={() => { store.clearSelection(); setShowDeleteConfirm(false) }} />}
        </AnimatePresence>
      </div>
    )
  }

  // ─── Render: Home Dashboard ─────────────────────────────
  const activeCategories = categoryStats.filter(c => c.count > 0)
  const totalCleanableSize = activeCategories.reduce((a, c) => a + c.size, 0)

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="px-4 pt-12 pb-3 shrink-0">
        <h1 className="text-white text-3xl font-bold mb-1">Cleanup</h1>
        <p className="text-[#8e8e93] text-sm">{store.photos.length} photos · {formatSize(totalSize)} used</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: 80 }}>
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

        {/* Add More Photos */}
        <motion.button whileTap={{ scale: 0.97 }} onClick={startScan}
          className="w-full bg-[#30d158]/10 border border-[#30d158]/20 rounded-2xl p-3 mb-4 flex items-center justify-center gap-2 ios-press">
          <Plus className="w-4 h-4 text-[#30d158]" />
          <span className="text-[#30d158] font-medium text-sm">Add More Photos</span>
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

      {/* Bottom Navigation - Only Home, Swipe, Smart */}
      <div className="fixed bottom-0 left-0 right-0 ios-backdrop border-t border-[#38383a] safe-bottom">
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
