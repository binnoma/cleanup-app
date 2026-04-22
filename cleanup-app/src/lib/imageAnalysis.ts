/**
 * Real image analysis utilities
 * - Blur detection using Laplacian variance
 * - Duplicate detection using average hash
 * - Screenshot detection by aspect ratio + filename
 * - Smart categorization
 */

// ─── Blur Detection ────────────────────────────────────────
export function detectBlur(imageUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 64 // Small size for fast processing
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(100); return }

        ctx.drawImage(img, 0, 0, size, size)
        const imageData = ctx.getImageData(0, 0, size, size)
        const gray = new Float32Array(size * size)

        // Convert to grayscale
        for (let i = 0; i < size * size; i++) {
          const r = imageData.data[i * 4]
          const g = imageData.data[i * 4 + 1]
          const b = imageData.data[i * 4 + 2]
          gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
        }

        // Apply Laplacian kernel
        let sum = 0
        let sumSq = 0
        let count = 0
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
    img.src = imageUrl
  })
}

// ─── Average Hash for Duplicate/Similar Detection ──────────
export function computeImageHash(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
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
    img.src = imageUrl
  })
}

// Compare two hashes (hamming distance)
export function hammingDistance(hash1: string, hash2: string): number {
  let dist = 0
  for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
    if (hash1[i] !== hash2[i]) dist++
  }
  return dist
}

// ─── Screenshot Detection ──────────────────────────────────
export function isScreenshot(name: string, width?: number, height?: number): boolean {
  const n = name.toLowerCase()
  // Check filename patterns
  if (n.includes('screenshot') || n.includes('scr_') || n.includes('screen shot') ||
      n.includes('screencapture') || n.includes('screen_capture') ||
      n.startsWith('scr-') || n.includes('screen_')) {
    return true
  }
  // Check if aspect ratio matches common screen ratios (16:9, 18:9, 19.5:9, 20:9)
  if (width && height) {
    const ratio = Math.max(width, height) / Math.min(width, height)
    const screenRatios = [16/9, 18/9, 19.5/9, 20/9, 19/9, 17/9]
    for (const sr of screenRatios) {
      if (Math.abs(ratio - sr) < 0.05) return true
    }
  }
  return false
}

// ─── Selfie Detection ──────────────────────────────────────
export function isSelfie(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('selfie') || n.includes('self_') || n.includes('front_') ||
         n.includes('portrait') || n.startsWith('img_selfie')
}

// ─── Analyze All Photos ────────────────────────────────────
export interface AnalysisResult {
  categories: string[]
  blurScore: number
  hash: string
  width: number
  height: number
}

export async function analyzePhoto(
  imageUrl: string,
  fileName: string,
  fileSize: number,
  fileDate: number,
): Promise<AnalysisResult> {
  const categories: string[] = []

  // Get image dimensions and hash
  const dims = await getImageDimensions(imageUrl)
  const hash = await computeImageHash(imageUrl)
  const blurScore = await detectBlur(imageUrl)

  // Blurry detection (variance < 50 = blurry)
  if (blurScore < 50) {
    categories.push('blurry')
  }

  // Screenshot detection
  if (isScreenshot(fileName, dims.width, dims.height)) {
    categories.push('screenshots')
  }

  // Selfie detection
  if (isSelfie(fileName)) {
    categories.push('selfies')
  }

  // Video detection (by extension)
  const ext = fileName.toLowerCase().split('.').pop() || ''
  if (['mp4', 'mov', 'avi', 'mkv', '3gp', 'wmv'].includes(ext)) {
    categories.push('videos')
  }

  // Large files (> 10MB)
  if (fileSize > 10 * 1024 * 1024) {
    categories.push('largeFiles')
  }

  // Old photos (> 1 year)
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
  if (fileDate < oneYearAgo) {
    categories.push('oldPhotos')
  }

  return {
    categories,
    blurScore,
    hash,
    width: dims.width,
    height: dims.height,
  }
}

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = url
  })
}

// Find duplicates and similar photos among a group
export function findDuplicatesAndSimilar(photos: { id: string; hash: string }[]): {
  duplicateIds: Set<string>
  similarIds: Set<string>
} {
  const duplicateIds = new Set<string>()
  const similarIds = new Set<string>()

  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      const dist = hammingDistance(photos[i].hash, photos[j].hash)
      if (dist <= 5) {
        // Very similar = duplicate
        duplicateIds.add(photos[i].id)
        duplicateIds.add(photos[j].id)
      } else if (dist <= 15) {
        // Somewhat similar
        similarIds.add(photos[i].id)
        similarIds.add(photos[j].id)
      }
    }
  }

  return { duplicateIds, similarIds }
}

// Convert File to base64 data URL
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
