import { registerPlugin } from '@capacitor/core'

export interface MediaItem {
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

export interface ScanResult {
  photos: MediaItem[]
  totalCount: number
}

export interface PermissionResult {
  granted: boolean
}

export interface MediaScannerPlugin {
  checkPermissions(): Promise<PermissionResult>
  requestPermissions(): Promise<PermissionResult>
  scanPhotos(): Promise<ScanResult>
}

const MediaScanner = registerPlugin<MediaScannerPlugin>('MediaScanner')

export default MediaScanner
