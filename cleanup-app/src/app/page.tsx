'use client'

import React, { useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import {
  Copy, Monitor, User, Video, Layers, Droplet, Sparkles, Clock, Grid3X3,
  Trash2, ChevronLeft, ChevronRight, Check, X, Plus, Scan, Zap,
  ArrowDownToLine, FolderOpen, Image as ImageIcon, AlertTriangle,
  RotateCcw, Hand, Sparkle, Search, CircleCheck, Camera
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

// Convert File to base64 data URL (works in Capacitor native)
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Icon Mapper ──────────────────────────────────────────────
const iconMap: Record<string, React.ElementType> = {
  Copy, Monitor, User, Video, Layers, Droplet, Sparkles, Clock, Grid: Grid3X3,
}

// ─── Delete Confirmation Dialog ───────────────────────────────
function DeleteConfirmDialog({
  count,
  onConfirm,
  onCancel,
}: {
  count: number
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center ios-backdrop"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#1c1c1e] rounded-2xl w-[270px] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-white text-lg font-semibold mb-1">Delete {count} Item{count > 1 ? 's' : ''}?</h3>
          <p className="text-[#8e8e93] text-sm">
            This action cannot be undone. The selected items will be permanently deleted.
          </p>
        </div>
        <div className="border-t border-[#38383a]">
          <button
            onClick={onCancel}
            className="w-full py-3.5 text-center text-[#0a84ff] text-lg font-normal border-b border-[#38383a] ios-press"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="w-full py-3.5 text-center text-[#ff453a] text-lg font-semibold ios-press"
          >
            Delete
          </button>
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2c2c2e" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="url(#greenGradient)"
          strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset} className="animate-draw-ring"
        />
        <defs>
          <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#30d158" />
            <stop offset="100%" stopColor="#34c759" />
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
function PhotoCard({
  photo,
  isSelected,
  onToggle,
  onDelete,
  selectionMode,
}: {
  photo: Photo
  isSelected: boolean
  onToggle: () => void
  onDelete: () => void
  selectionMode: boolean
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, y: -20 }}
      transition={{ duration: 0.25 }}
      className="relative group"
    >
      <div
        className={`relative rounded-xl overflow-hidden aspect-square cursor-pointer ios-press ${
          isSelected ? 'ring-2 ring-[#30d158] ring-offset-2 ring-offset-black' : ''
        }`}
        onClick={selectionMode ? onToggle : undefined}
      >
        <img
          src={photo.url}
          alt={photo.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" fill="#2c2c2e"><rect width="200" height="200"/><text x="100" y="105" text-anchor="middle" fill="#8e8e93" font-size="12">${photo.name}</text></svg>`
            )}`
          }}
        />
        {selectionMode && (
          <div className="absolute top-2 left-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isSelected ? 'bg-[#30d158]' : 'bg-black/50 border border-white/30'
            }`}>
              {isSelected && <Check className="w-4 h-4 text-white" />}
            </div>
          </div>
        )}
        {!selectionMode && (
          <div className="absolute inset-0 bg-black/0 group-active:bg-black/30 transition-all flex items-center justify-center opacity-0 group-active:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            <button className="p-2 bg-red-500/80 rounded-full ios-press">
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-1 px-1">
        <p className="text-[#8e8e93] text-[10px] truncate">{photo.name}</p>
        <p className="text-[#8e8e93] text-[10px]">{formatSize(photo.size)}</p>
      </div>
    </motion.div>
  )
}

// ─── Swipe Card Component ─────────────────────────────────────
function SwipeCard({
  photo,
  onSwipe,
  isTop,
}: {
  photo: Photo
  onSwipe: (direction: 'left' | 'right') => void
  isTop: boolean
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-15, 15])
  const leftOpacity = useTransform(x, [-100, 0], [1, 0])
  const rightOpacity = useTransform(x, [0, 100], [0, 1])

  const handleDragEnd = (_: never, info: PanInfo) => {
    if (info.offset.x > 80) onSwipe('right')
    else if (info.offset.x < -80) onSwipe('left')
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate, zIndex: isTop ? 10 : 5 }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.5 }}
      animate={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.5 }}
    >
      <div className="w-full h-full rounded-2xl overflow-hidden bg-[#1c1c1e] shadow-2xl">
        <img
          src={photo.url}
          alt={photo.name}
          className="w-full h-[70%] object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" fill="#2c2c2e"><rect width="400" height="400"/><text x="200" y="200" text-anchor="middle" fill="#8e8e93" font-size="16">${photo.name}</text></svg>`
            )}`
          }}
        />
        <div className="p-4">
          <h3 className="text-white font-semibold text-lg">{photo.name}</h3>
          <p className="text-[#8e8e93] text-sm mt-1">{formatSize(photo.size)} · {formatDate(photo.date)}</p>
          <div className="flex gap-2 mt-3">
            {photo.category.filter(c => c !== 'allPhotos').map(c => (
              <span key={c} className="text-xs bg-white/10 text-white/70 px-2 py-1 rounded-full capitalize">{c}</span>
            ))}
          </div>
        </div>
      </div>
      <motion.div style={{ opacity: leftOpacity }} className="absolute top-8 left-8 bg-red-500/80 rounded-xl px-4 py-2 -rotate-12">
        <span className="text-white font-bold text-lg">DELETE</span>
      </motion.div>
      <motion.div style={{ opacity: rightOpacity }} className="absolute top-8 right-8 bg-green-500/80 rounded-xl px-4 py-2 rotate-12">
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
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const categoryPhotos = useMemo(() => {
    if (!store.activeCategory) return []
    return store.getPhotosByCategory(store.activeCategory)
  }, [store.activeCategory, store.photos])

  const categoryStats = useMemo(() => store.getCategoryStats(), [store.photos])
  const totalSize = useMemo(() => store.getTotalSize(), [store.photos])
  const selectedSize = useMemo(() => store.getSelectedSize(), [store.photos, store.selectedPhotos])
  const totalDeviceSize = 128 * 1073741824

  // ─── Scan Animation ──────────────────────────────────────
  const startScan = useCallback(() => {
    setIsScanning(true)
    setScanProgress(0)
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        store.generateDemoData()
        setIsScanning(false)
      }
      setScanProgress(Math.min(progress, 100))
    }, 200)
  }, [store])

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

  // ─── Import Photos (async with base64) ────────────────────
  const handleImport = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsImporting(true)

    try {
      const newPhotos: Photo[] = []
      const maxToAdd = Math.min(files.length, store.maxPhotos - store.photos.length)

      for (let i = 0; i < maxToAdd; i++) {
        const file = files[i]
        // Convert to data URL so it works in native WebView
        const dataUrl = await fileToDataURL(file)
        const categories = ['allPhotos']

        // Smart categorization
        if (file.type.startsWith('video/')) categories.push('videos')
        const nameLower = file.name.toLowerCase()
        if (nameLower.includes('screenshot') || nameLower.includes('scr_') || nameLower.includes('screen')) categories.push('screenshots')
        if (nameLower.includes('selfie') || nameLower.includes('self') || nameLower.includes('front')) categories.push('selfies')
        if (nameLower.includes('img_') || nameLower.includes('dsc_')) categories.push('similar')

        newPhotos.push({
          id: `import-${Date.now()}-${i}`,
          name: file.name,
          url: dataUrl, // Use data URL instead of blob URL
          size: file.size,
          date: file.lastModified || Date.now(),
          category: categories,
          isVideo: file.type.startsWith('video/'),
          isScreenshot: nameLower.includes('screenshot'),
          isSelfie: nameLower.includes('selfie'),
        })
      }

      if (newPhotos.length > 0) {
        store.addPhotos(newPhotos)
        store.setScanComplete(true)
        store.setScreen('home')
      }
    } catch (err) {
      console.error('Import error:', err)
    } finally {
      setIsImporting(false)
    }
  }, [store])

  // ─── Native Camera Picker ────────────────────────────────
  const openCameraPicker = useCallback(async () => {
    try {
      // Try native Capacitor Camera API first
      const { Camera: CapCamera, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const photo = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos, // Opens photo library
      })

      const newPhoto: Photo = {
        id: `camera-${Date.now()}`,
        name: `Photo_${Date.now()}.jpg`,
        url: photo.dataUrl || '',
        size: Math.round((photo.dataUrl?.length || 0) * 0.75),
        date: Date.now(),
        category: ['allPhotos'],
      }

      store.addPhotos([newPhoto])
      store.setScanComplete(true)
    } catch (err: unknown) {
      // If Capacitor not available (web browser), fallback to file input
      console.log('Camera API not available, using file picker:', err)
      fileInputRef.current?.click()
    }
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
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-24 h-24 mb-8">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#2c2c2e" strokeWidth="6" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="#30d158" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${scanProgress * 2.51} 251`} className="transition-all duration-200" />
          </svg>
        </motion.div>
        <h2 className="text-white text-2xl font-bold mb-2">Scanning Photos...</h2>
        <p className="text-[#8e8e93] text-center mb-4">Finding duplicates, blurry shots, and clutter</p>
        <div className="w-64 h-1.5 bg-[#2c2c2e] rounded-full overflow-hidden">
          <motion.div className="h-full bg-[#30d158] rounded-full" style={{ width: `${scanProgress}%` }} />
        </div>
        <p className="text-[#30d158] text-sm mt-3 font-medium">{Math.round(scanProgress)}%</p>
      </div>
    )
  }

  // ─── Render: Home Screen ────────────────────────────────
  if (store.currentScreen === 'home' && !store.scanComplete) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[#30d158] to-[#28a745] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
            <Sparkle className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-white text-4xl font-bold mb-3">Cleanup</h1>
          <p className="text-[#8e8e93] text-lg mb-8 max-w-xs mx-auto">Clean up your device and optimize storage in seconds</p>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={startScan}
            className="w-full max-w-xs mx-auto bg-[#30d158] text-white font-semibold text-lg py-4 rounded-2xl shadow-lg shadow-green-500/30 mb-4 ios-press"
          >
            <div className="flex items-center justify-center gap-2">
              <Scan className="w-5 h-5" />
              <span>Start Scan</span>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => store.generateDemoData()}
            className="w-full max-w-xs mx-auto bg-[#1c1c1e] text-[#30d158] font-semibold text-base py-3.5 rounded-2xl border border-[#30d158]/20 mb-4 ios-press"
          >
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Load Demo Data</span>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={openCameraPicker}
            className="w-full max-w-xs mx-auto bg-[#1c1c1e] text-white font-semibold text-base py-3.5 rounded-2xl border border-[#38383a] ios-press"
          >
            <div className="flex items-center justify-center gap-2">
              <Camera className="w-4 h-4 text-[#0a84ff]" />
              <span>Import from Phone</span>
            </div>
          </motion.button>

          <p className="text-[#8e8e93] text-xs mt-6">Up to 30,000 photos supported</p>
        </motion.div>

        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={(e) => handleImport(e.target.files)} />
      </div>
    )
  }

  // ─── Render: Import Screen ──────────────────────────────
  if (store.currentScreen === 'import') {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex items-center px-4 py-3 border-b border-[#38383a]">
          <button onClick={() => store.setScreen('home')} className="p-2 ios-press">
            <ChevronLeft className="w-6 h-6 text-[#0a84ff]" />
          </button>
          <h1 className="text-white text-lg font-semibold flex-1 text-center">Import Photos</h1>
          <div className="w-10" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          {isImporting ? (
            <div className="text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 border-3 border-[#30d158] border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-white text-lg font-semibold">Importing...</p>
              <p className="text-[#8e8e93] text-sm">Processing your photos</p>
            </div>
          ) : (
            <>
              {/* Import from Phone - Primary */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={openCameraPicker}
                className="w-full max-w-sm bg-[#30d158] text-white font-semibold text-lg py-5 rounded-2xl ios-press"
              >
                <div className="flex items-center justify-center gap-3">
                  <Camera className="w-6 h-6" />
                  <span>Import from Phone</span>
                </div>
                <p className="text-white/70 text-xs mt-1">Access your photo library</p>
              </motion.button>

              {/* Browse Files - Secondary */}
              <div
                className="w-full max-w-sm border-2 border-dashed border-[#38383a] rounded-3xl p-8 text-center hover:border-[#30d158] transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleImport(e.dataTransfer.files) }}
              >
                <FolderOpen className="w-10 h-10 text-[#8e8e93] mx-auto mb-3" />
                <h3 className="text-white text-lg font-semibold mb-1">Browse Files</h3>
                <p className="text-[#8e8e93] text-sm">Drag and drop or tap to browse</p>
              </div>

              <p className="text-[#8e8e93] text-xs mt-2">
                {store.photos.length} / {store.maxPhotos.toLocaleString()} photos
              </p>
            </>
          )}
        </div>

        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={(e) => handleImport(e.target.files)} />
      </div>
    )
  }

  // ─── Render: Results Screen ─────────────────────────────
  if (store.currentScreen === 'results') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', damping: 12 }}
            className="w-24 h-24 rounded-full bg-[#30d158]/20 flex items-center justify-center mx-auto mb-6">
            <CircleCheck className="w-12 h-12 text-[#30d158]" />
          </motion.div>
          <h2 className="text-white text-3xl font-bold mb-2">All Clean!</h2>
          <p className="text-[#8e8e93] text-lg mb-8">Your device is optimized</p>
          <div className="bg-[#1c1c1e] rounded-2xl p-6 w-full max-w-xs mx-auto mb-8">
            <div className="text-[#30d158] text-3xl font-bold mb-1">{formatSize(totalSize)}</div>
            <p className="text-[#8e8e93] text-sm">Total storage used</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {categoryStats.filter(c => c.count > 0 && c.id !== 'allPhotos').slice(0, 4).map(cat => (
                <div key={cat.id} className="text-center">
                  <p className="text-white font-semibold">{cat.count}</p>
                  <p className="text-[#8e8e93] text-xs">{cat.name}</p>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => { store.setScreen('home'); store.setScanComplete(false) }}
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
            className="p-2 ios-press">
            <ChevronLeft className="w-6 h-6 text-[#0a84ff]" />
          </button>
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
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-[#1c1c1e] border-b border-[#38383a]">
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

        <div className="flex-1 overflow-y-auto p-3 pb-24">
          {categoryPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <ImageIcon className="w-16 h-16 text-[#38383a] mb-4" />
              <p className="text-[#8e8e93] text-lg">No photos in this category</p>
              <button onClick={openCameraPicker} className="mt-4 bg-[#30d158] text-white font-semibold px-6 py-3 rounded-xl ios-press">
                <div className="flex items-center gap-2"><Camera className="w-4 h-4" /><span>Import Photos</span></div>
              </button>
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
            <ChevronLeft className="w-6 h-6 text-[#0a84ff]" />
          </button>
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
              <p className="text-[#8e8e93] text-center mb-6">You&apos;ve reviewed all photos</p>
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
                  <X className="w-8 h-8 text-[#ff453a]" />
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleSwipe('right')}
                  className="w-16 h-16 rounded-full bg-[#30d158]/20 flex items-center justify-center ios-press">
                  <Check className="w-8 h-8 text-[#30d158]" />
                </motion.button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── Render: Smart Clean ────────────────────────────────
  if (store.currentScreen === 'smartClean') {
    const cleanablePhotos = categoryStats.filter(c => c.id !== 'allPhotos' && c.count > 0).sort((a, b) => b.size - a.size)
    const totalCleanable = cleanablePhotos.reduce((a, c) => a + c.size, 0)
    const totalCleanableCount = cleanablePhotos.reduce((a, c) => a + c.count, 0)
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex items-center px-4 py-3 border-b border-[#38383a]">
          <button onClick={() => store.setScreen('home')} className="p-2 ios-press">
            <ChevronLeft className="w-6 h-6 text-[#0a84ff]" />
          </button>
          <h1 className="text-white text-lg font-semibold flex-1 text-center">Smart Clean</h1>
          <div className="w-10" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="text-center mb-6">
            <div className="text-[#30d158] text-4xl font-bold mb-1">{formatSize(totalCleanable)}</div>
            <p className="text-[#8e8e93]">Can be freed up</p>
            <p className="text-[#8e8e93] text-sm">{totalCleanableCount} items found</p>
          </div>
          {cleanablePhotos.map((cat, idx) => {
            const Icon = iconMap[cat.icon] || Layers
            return (
              <motion.div key={cat.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}
                className="bg-[#1c1c1e] rounded-2xl p-4 mb-3 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '20' }}>
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
  const activeCategories = categoryStats.filter(c => c.count > 0 && c.id !== 'allPhotos')
  const totalCleanableSize = activeCategories.reduce((a, c) => a + c.size, 0)

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-white text-3xl font-bold">Cleanup</h1>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.9 }} onClick={openCameraPicker}
              className="w-9 h-9 rounded-full bg-[#1c1c1e] flex items-center justify-center ios-press">
              <Camera className="w-4 h-4 text-[#0a84ff]" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => store.setScreen('import')}
              className="w-9 h-9 rounded-full bg-[#1c1c1e] flex items-center justify-center ios-press">
              <Plus className="w-4 h-4 text-[#30d158]" />
            </motion.button>
          </div>
        </div>
        <p className="text-[#8e8e93] text-sm">{store.photos.length} photos · {formatSize(totalSize)} used</p>
      </div>

      <div className="flex justify-center py-4">
        <StorageRing used={totalSize} total={totalDeviceSize} size={180} />
      </div>

      <div className="px-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => { store.setActiveCategory('duplicates'); store.setScreen('swipe'); setSwipeIndex(0) }}
            className="bg-[#1c1c1e] rounded-2xl p-4 text-left ios-press">
            <Hand className="w-6 h-6 text-[#0a84ff] mb-2" />
            <h3 className="text-white font-semibold text-sm">Swipe Clean</h3>
            <p className="text-[#8e8e93] text-xs mt-0.5">Swipe to delete</p>
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => store.setScreen('smartClean')}
            className="bg-[#1c1c1e] rounded-2xl p-4 text-left ios-press">
            <Zap className="w-6 h-6 text-[#ff9f0a] mb-2" />
            <h3 className="text-white font-semibold text-sm">Smart Clean</h3>
            <p className="text-[#8e8e93] text-xs mt-0.5">{activeCategories.length > 0 ? `${formatSize(totalCleanableSize)} to free` : 'Scan first'}</p>
          </motion.button>
        </div>
      </div>

      <div className="px-4 flex-1 overflow-y-auto pb-24">
        <h2 className="text-white text-lg font-semibold mb-3">Categories</h2>
        <div className="space-y-2">
          {categoryStats.map((cat, idx) => {
            const Icon = iconMap[cat.icon] || Layers
            return (
              <motion.button key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { store.setActiveCategory(cat.id); store.setScreen('category'); setSelectionMode(false); store.clearSelection() }}
                className="w-full bg-[#1c1c1e] rounded-2xl p-4 flex items-center gap-3 ios-press text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '20' }}>
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

      <div className="fixed bottom-0 left-0 right-0 ios-backdrop border-t border-[#38383a] safe-bottom">
        <div className="flex items-center justify-around py-2 px-4">
          <button onClick={() => store.setScreen('home')} className="flex flex-col items-center gap-0.5 py-1 ios-press">
            <Sparkle className="w-5 h-5 text-[#30d158]" /><span className="text-[#30d158] text-[10px] font-medium">Home</span>
          </button>
          <button onClick={openCameraPicker} className="flex flex-col items-center gap-0.5 py-1 ios-press">
            <Camera className="w-5 h-5 text-[#0a84ff]" /><span className="text-[#0a84ff] text-[10px]">Import</span>
          </button>
          <button onClick={() => { store.setActiveCategory('allPhotos'); store.setScreen('category'); setSelectionMode(false) }}
            className="flex flex-col items-center gap-0.5 py-1 ios-press">
            <Grid3X3 className="w-5 h-5 text-[#8e8e93]" /><span className="text-[#8e8e93] text-[10px]">All Photos</span>
          </button>
          <button onClick={() => { store.setActiveCategory('duplicates'); store.setScreen('swipe'); setSwipeIndex(0) }}
            className="flex flex-col items-center gap-0.5 py-1 ios-press">
            <Hand className="w-5 h-5 text-[#8e8e93]" /><span className="text-[#8e8e93] text-[10px]">Swipe</span>
          </button>
          <button onClick={() => store.setScreen('smartClean')} className="flex flex-col items-center gap-0.5 py-1 ios-press">
            <Zap className="w-5 h-5 text-[#8e8e93]" /><span className="text-[#8e8e93] text-[10px]">Smart</span>
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
        onChange={(e) => handleImport(e.target.files)} />

      <AnimatePresence>
        {showDeleteConfirm && <DeleteConfirmDialog count={store.selectedPhotos.size} onConfirm={confirmDelete} onCancel={() => setShowDeleteConfirm(false)} />}
      </AnimatePresence>
    </div>
  )
}
