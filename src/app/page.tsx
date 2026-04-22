"use client";

import React, { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import {
  Home, Upload, HandMetal, Grid3X3, Sparkles, Trash2, Check,
  ChevronLeft, ChevronRight, X, RefreshCw, Camera, Image,
  Video, Monitor, Users, ArrowRight, Zap, FolderOpen,
  AlertCircle, Eye, Clock, Aperture, Layers, AlertTriangle,
  Heart, Info, Trash, ChevronUp
} from "lucide-react";
import { useCleanupStore, PhotoItem, PhotoCategory, Screen, CategoryFilter } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/* ─── Constants ─── */
const MAX_PHOTOS = 30000;
const STORAGE_TOTAL = 128 * 1024 * 1024 * 1024;
const PAGE_SIZE = 120; // photos per page in grid view

/* ─── Utility helpers ─── */
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

/* ═══════════════════════════════════════════
   iOS-STYLE DELETE CONFIRMATION DIALOG
   ═══════════════════════════════════════════ */
function IosDeleteDialog({ open, onConfirm, onCancel, count, size, itemName }: {
  open: boolean; onConfirm: () => void; onCancel: () => void;
  count: number; size: number; itemName?: string;
}) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
        <motion.div
          className="relative z-10 w-[270px] bg-white dark:bg-gray-800 rounded-[14px] overflow-hidden shadow-2xl"
          initial={{ scale: 0.5, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.5, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-[17px] font-semibold text-foreground mb-1">
              Delete {count > 1 ? `${count} Items` : "Item"}?
            </h3>
            <p className="text-[13px] text-muted-foreground leading-snug">
              {count === 1 && itemName
                ? `"${itemName.length > 25 ? itemName.slice(0, 25) + "..." : itemName}" (${formatSize(size)}) will be deleted. This action cannot be undone.`
                : `${count} items (${formatSize(size)}) will be deleted. This action cannot be undone.`
              }
            </p>
          </div>
          <div className="h-px bg-gray-200 dark:bg-gray-700" />
          <div className="flex">
            <button
              className="flex-1 py-3.5 text-[17px] font-medium text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors active:bg-gray-100"
              onClick={onCancel}
            >
              Cancel
            </button>
            <div className="w-px bg-gray-200 dark:bg-gray-700" />
            <button
              className="flex-1 py-3.5 text-[17px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:bg-red-100"
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════
   PHOTO DETAIL / PREVIEW MODAL
   ═══════════════════════════════════════════ */
function PhotoDetailModal({ photo, open, onClose, onDelete }: {
  photo: PhotoItem | null; open: boolean;
  onClose: () => void; onDelete: (id: string) => void;
}) {
  if (!open || !photo) return null;

  const isVideo = photo.category === "video";
  const isBlurry = photo.category === "blurry";
  const isLive = photo.category === "livephoto";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[150] bg-black flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-black/80 backdrop-blur-md z-10">
          <button onClick={onClose} className="text-white/80 hover:text-white flex items-center gap-1 text-sm font-medium">
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <Badge className="bg-white/15 text-white border-0 capitalize text-xs">{photo.category}</Badge>
          <button
            onClick={() => onDelete(photo.id)}
            className="text-red-400 hover:text-red-300 p-1"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Photo preview */}
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${photo.color}, ${photo.color}88)`,
              filter: isBlurry ? "blur(2px)" : "none",
            }}
          >
            <div className="w-full h-full flex flex-col items-center justify-center p-6">
              {isVideo ? <Video className="w-20 h-20 text-white/80 mb-4" />
              : isBlurry ? <AlertCircle className="w-20 h-20 text-white/60 mb-4" />
              : isLive ? <Aperture className="w-20 h-20 text-white/80 mb-4" />
              : <Camera className="w-20 h-20 text-white/80 mb-4" />}
              <h3 className="text-white text-xl font-bold mb-2">{photo.name}</h3>
            </div>
          </motion.div>
        </div>

        {/* Info panel */}
        <motion.div
          className="bg-gray-900/90 backdrop-blur-md rounded-t-3xl px-6 pt-4 pb-8"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wide mb-0.5">Size</p>
              <p className="text-white text-sm font-semibold">{formatSize(photo.size)}</p>
            </div>
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wide mb-0.5">Date</p>
              <p className="text-white text-sm font-semibold">{formatDate(photo.date)}</p>
            </div>
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wide mb-0.5">Type</p>
              <p className="text-white text-sm font-semibold capitalize">{photo.category}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl border-white/20 text-white hover:bg-white/10" onClick={onClose}>
              <Heart className="w-4 h-4 mr-1.5" /> Keep
            </Button>
            <Button className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white" onClick={() => onDelete(photo.id)}>
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── PhotoCard with delete animation ─── */
function PhotoCard({ photo, selected, onToggle, compact, onOpenDetail }: {
  photo: PhotoItem; selected?: boolean; onToggle?: () => void; compact?: boolean;
  onOpenDetail?: () => void;
}) {
  const isVideo = photo.category === "video";
  const isBlurry = photo.category === "blurry";
  const isLive = photo.category === "livephoto";

  return (
    <AnimatePresence>
      {!photo.deleted && (
        <motion.div
          layout
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.4, y: 20 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className={`relative group rounded-xl overflow-hidden shadow-md ${
            selected ? "ring-3 ring-emerald-500 scale-[0.96]" : "hover:shadow-lg"
          } ${compact ? "w-full aspect-square" : "w-full aspect-[3/4]"} transition-shadow cursor-pointer`}
          onClick={(e) => {
            e.stopPropagation();
            if (onToggle) onToggle();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (onOpenDetail) onOpenDetail();
          }}
        >
          <div
            className="w-full h-full flex flex-col items-center justify-center p-2"
            style={{
              background: isBlurry
                ? `linear-gradient(135deg, ${photo.color}, ${photo.color}44)`
                : `linear-gradient(135deg, ${photo.color}, ${photo.color}88)`,
              filter: isBlurry ? "blur(1.5px)" : "none",
            }}
          >
            {isVideo ? <Video className="w-6 h-6 text-white/80" />
            : isBlurry ? <AlertCircle className="w-6 h-6 text-white/60" />
            : isLive ? <Aperture className="w-6 h-6 text-white/80" />
            : <Camera className="w-6 h-6 text-white/80" />}
            <span className="text-white/90 text-[9px] mt-0.5 font-medium truncate max-w-full">{photo.name}</span>
          </div>
          {onToggle && (
            <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              selected ? "bg-emerald-500 border-emerald-500" : "bg-white/60 border-white/80 group-hover:bg-white/80"
            }`}>
              {selected && <Check className="w-3 h-3 text-white" />}
            </div>
          )}
          {photo.kept && (
            <div className="absolute top-1.5 left-1.5 bg-emerald-500 text-white text-[8px] px-1 py-0.5 rounded-full font-medium">Keep</div>
          )}
          {/* Category badges */}
          {isBlurry && (
            <div className="absolute bottom-1 left-1 bg-gray-500/70 text-white text-[7px] px-1 py-0.5 rounded font-medium flex items-center gap-0.5">
              <AlertCircle className="w-2 h-2" /> Blurry
            </div>
          )}
          {isLive && (
            <div className="absolute bottom-1 left-1 bg-purple-500/70 text-white text-[7px] px-1 py-0.5 rounded font-medium flex items-center gap-0.5">
              <Aperture className="w-2 h-2" /> Live
            </div>
          )}
          {/* Long-press indicator */}
          <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Info className="w-3 h-3 text-white/60" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Circular Progress ─── */
function CircularProgress({ value, size = 200, strokeWidth = 14, children }: {
  value: number; size?: number; strokeWidth?: number; children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor"
          className="text-muted/30" strokeWidth={strokeWidth} />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="url(#grad)"
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }} />
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HOME SCREEN
   ═══════════════════════════════════════════ */
function HomeScreen() {
  const { photos, spaceFreed, getStats, setScreen, smartClean, setIsCleaning, loadDemoPhotos, demoLoaded } = useCleanupStore();
  const stats = getStats();
  const usedPercent = Math.min(((stats.totalSize + spaceFreed) / STORAGE_TOTAL) * 100, 100);

  const categories = [
    { key: "allphotos" as const, label: "All Photos", icon: <Layers className="w-5 h-5" />, count: stats.totalPhotos, color: "from-emerald-400 to-emerald-600" },
    { key: "duplicates" as const, label: "Duplicates", icon: <FolderOpen className="w-5 h-5" />, count: stats.duplicates, color: "from-orange-400 to-orange-600" },
    { key: "similar" as const, label: "Similar", icon: <Eye className="w-5 h-5" />, count: stats.similar, color: "from-amber-400 to-amber-600" },
    { key: "blurry" as const, label: "Blurry", icon: <AlertCircle className="w-5 h-5" />, count: stats.blurry, color: "from-gray-400 to-gray-600" },
    { key: "screenshots" as const, label: "Screenshots", icon: <Monitor className="w-5 h-5" />, count: stats.screenshots, color: "from-cyan-400 to-cyan-600" },
    { key: "selfies" as const, label: "Selfies", icon: <Users className="w-5 h-5" />, count: stats.selfies, color: "from-pink-400 to-pink-600" },
    { key: "largeVideos" as const, label: "Videos", icon: <Video className="w-5 h-5" />, count: stats.largeVideos, color: "from-purple-400 to-purple-600" },
    { key: "livephoto" as const, label: "Live Photos", icon: <Aperture className="w-5 h-5" />, count: stats.livePhotos, color: "from-blue-400 to-blue-600" },
    { key: "old" as const, label: "Old Photos", icon: <Clock className="w-5 h-5" />, count: stats.old, color: "from-rose-400 to-rose-600" },
  ];

  const handleSmartClean = () => {
    setIsCleaning(true);
    setTimeout(() => smartClean(), 1500);
  };

  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-4 min-h-screen bg-gradient-to-b from-emerald-50/50 to-white dark:from-gray-950 dark:to-gray-900">
      <motion.h1 className="text-2xl font-bold text-foreground mb-1" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        Cleanup
      </motion.h1>
      <p className="text-sm text-muted-foreground mb-6">Free up space on your device</p>

      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
        <CircularProgress value={usedPercent} size={200} strokeWidth={14}>
          <span className="text-3xl font-bold text-foreground">{usedPercent.toFixed(0)}%</span>
          <span className="text-xs text-muted-foreground">Storage Used</span>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5">{formatSize(stats.totalSize)} of 128 GB</span>
        </CircularProgress>
      </motion.div>

      {spaceFreed > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
          <Zap className="w-4 h-4" /> {formatSize(spaceFreed)} freed up!
        </motion.div>
      )}

      <div className="w-full max-w-md mt-6 space-y-2">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
          <span className="text-sm text-muted-foreground">{stats.reclaimable > 0 ? formatSize(stats.reclaimable) + " reclaimable" : "No clutter"}</span>
        </div>
        {categories.map((cat, i) => (
          <motion.div
            key={cat.key} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center justify-between p-3 bg-card rounded-xl border border-border/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
            onClick={() => {
              if (cat.count > 0 || cat.key === "allphotos") {
                useCleanupStore.getState().setCategoryFilter(cat.key as CategoryFilter);
                setScreen("categories");
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-white`}>{cat.icon}</div>
              <span className="font-medium text-foreground">{cat.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{cat.count}</Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </motion.div>
        ))}
      </div>

      {stats.reclaimable > 0 && (
        <motion.div className="w-full max-w-md mt-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Button size="lg" className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 rounded-2xl" onClick={handleSmartClean}>
            <Sparkles className="w-5 h-5 mr-2" /> Smart Clean
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-2">Remove all clutter and keep the best photos</p>
        </motion.div>
      )}

      {photos.length === 0 && (
        <motion.div className="w-full max-w-md mt-8 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto flex items-center justify-center mb-4">
            <Image className="w-10 h-10 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Photos Yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Import your photos or load demo data to start cleaning up.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setScreen("import")} className="rounded-xl"><Upload className="w-4 h-4 mr-2" /> Import</Button>
            <Button onClick={loadDemoPhotos} className="rounded-xl bg-emerald-600 hover:bg-emerald-700"><FolderOpen className="w-4 h-4 mr-2" /> Load Demo</Button>
          </div>
        </motion.div>
      )}

      {photos.length > 0 && (
        <div className="w-full max-w-md mt-4 grid grid-cols-3 gap-3">
          {[{ label: "Photos", value: stats.totalPhotos }, { label: "Kept", value: stats.keptCount }, { label: "Deleted", value: stats.deletedCount }].map((s) => (
            <div key={s.label} className="text-center p-3 bg-card rounded-xl border border-border/50">
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   IMPORT SCREEN
   ═══════════════════════════════════════════ */
function ImportScreen() {
  const { addPhotos, loadDemoPhotos, demoLoaded, photos, setScreen, setIsScanning } = useCleanupStore();
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setIsScanning(true);
    const newPhotos: PhotoItem[] = [];
    const currentCount = useCleanupStore.getState().photos.length;
    const remaining = MAX_PHOTOS - currentCount;
    const filesToProcess = Array.from(files).slice(0, Math.max(0, remaining));
    const colors = ["#EF4444", "#F97316", "#F59E0B", "#22C55E", "#10B981", "#06B6D4", "#8B5CF6", "#EC4899"];

    for (const file of filesToProcess) {
      const id = Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      const url = URL.createObjectURL(file);
      let category: PhotoCategory = "photo";
      const nameLC = file.name.toLowerCase();
      if (nameLC.includes("screenshot") || nameLC.includes("screen")) category = "screenshot";
      else if (nameLC.includes("selfie") || nameLC.includes("self")) category = "selfie";
      else if (file.type.startsWith("video/")) category = "video";
      else if (nameLC.includes("blurry") || nameLC.includes("blur")) category = "blurry";
      else if (nameLC.includes("live")) category = "livephoto";

      newPhotos.push({ id, url, name: file.name, size: file.size, type: file.type, width: 3024, height: 4032, category, kept: false, deleted: false, deleting: false, duplicateGroupId: null, color: colors[Math.floor(Math.random() * colors.length)], date: new Date().toISOString() });
    }
    addPhotos(newPhotos);
    setTimeout(() => setIsScanning(false), 800);
  }, [addPhotos, setIsScanning]);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files); }, [processFiles]);
  const currentCount = photos.length;

  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-4 min-h-screen bg-gradient-to-b from-emerald-50/50 to-white dark:from-gray-950 dark:to-gray-900">
      <h1 className="text-2xl font-bold text-foreground mb-1">Import Photos</h1>
      <p className="text-sm text-muted-foreground mb-2">Add photos to start cleaning</p>
      <p className="text-xs text-muted-foreground/70 mb-6">{currentCount.toLocaleString()} / {MAX_PHOTOS.toLocaleString()}</p>

      <motion.div
        className={`w-full max-w-md h-52 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-colors cursor-pointer ${dragActive ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "border-border bg-card hover:border-emerald-400"}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
      >
        <motion.div animate={dragActive ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300 }}>
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3 mx-auto"><Upload className="w-7 h-7 text-emerald-600" /></div>
        </motion.div>
        <p className="text-base font-semibold text-foreground">Drop photos here</p>
        <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) processFiles(e.target.files); }} />
      </motion.div>

      {currentCount > MAX_PHOTOS * 0.9 && (
        <div className="w-full max-w-md mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 inline mr-1" /> Approaching limit ({currentCount.toLocaleString()} / {MAX_PHOTOS.toLocaleString()})
        </div>
      )}

      <div className="w-full max-w-md mt-5">
        <div className="flex items-center gap-3 mb-3"><Separator className="flex-1" /><span className="text-xs text-muted-foreground">OR</span><Separator className="flex-1" /></div>
        <Button variant="outline" size="lg" className="w-full rounded-2xl h-13 text-base" onClick={loadDemoPhotos}>
          <FolderOpen className="w-5 h-5 mr-2" /> Load Demo Photos {!demoLoaded && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-2">70+ samples with duplicates, blurry, screenshots & more</p>
      </div>

      {photos.length > 0 && (
        <Card className="w-full max-w-md mt-5 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><Image className="w-5 h-5 text-emerald-600" /></div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Library: {photos.filter(p => !p.deleted).length.toLocaleString()} items</p>
                <p className="text-xs text-muted-foreground">{formatSize(photos.filter(p => !p.deleted).reduce((a, p) => a + p.size, 0))}</p>
              </div>
              <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => setScreen("swipe")}>Swipe</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SWIPE MODE
   ═══════════════════════════════════════════ */
function SwipeScreen() {
  const { photos, markAsKept, markAsDeleted, setScreen } = useCleanupStore();
  const [index, setIndex] = useState(0);

  const activePhotos = photos.filter((p) => !p.deleted && !p.kept);
  const safeIndex = Math.min(Math.max(0, index), activePhotos.length > 0 ? activePhotos.length - 1 : 0);
  const currentPhoto = activePhotos[safeIndex];
  const total = activePhotos.length;

  const handleSwipe = (dir: "left" | "right") => {
    if (!currentPhoto) return;
    if (dir === "right") markAsKept(currentPhoto.id); else markAsDeleted(currentPhoto.id);
  };

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-25, 0, 25]);
  const keepOpacity = useTransform(x, [0, 150], [0, 1]);
  const deleteOpacity = useTransform(x, [-150, 0], [1, 0]);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-b from-emerald-50/50 to-white dark:from-gray-950 dark:to-gray-900">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4 mx-auto"><Check className="w-10 h-10 text-emerald-600" /></div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-2">All Done!</h2>
          <p className="text-muted-foreground text-center mb-6">You&apos;ve reviewed all your photos</p>
          <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={() => setScreen("home")}><Home className="w-4 h-4 mr-2" /> Home</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 relative">
      <div className="w-full px-4 pt-4 pb-2 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setScreen("home")}><ChevronLeft className="w-5 h-5" /></Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{safeIndex + 1} of {total}</p>
          <p className="text-xs text-muted-foreground">Swipe right = keep, left = delete</p>
        </div>
        <div className="w-10" />
      </div>
      <div className="w-full px-4 mb-4"><Progress value={total > 0 ? ((safeIndex + 1) / total) * 100 : 0} className="h-1.5" /></div>

      <div className="flex-1 flex items-center justify-center w-full px-4 relative">
        <AnimatePresence mode="wait">
          <motion.div key={currentPhoto?.id || "empty"} className="w-full max-w-sm" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
            <motion.div style={{ x, rotate }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.9}
              onDragEnd={(_e, info: PanInfo) => { if (Math.abs(info.offset.x) > 100) { handleSwipe(info.offset.x > 0 ? "right" : "left"); x.set(0); } else { x.set(0); } }}
              className="cursor-grab active:cursor-grabbing"
            >
              <motion.div style={{ opacity: keepOpacity }} className="absolute top-8 left-8 z-10 bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xl rotate-[-12deg] shadow-lg">KEEP</motion.div>
              <motion.div style={{ opacity: deleteOpacity }} className="absolute top-8 right-8 z-10 bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xl rotate-[12deg] shadow-lg">DELETE</motion.div>
              <div
                className="w-full aspect-[3/4] rounded-3xl shadow-2xl overflow-hidden"
                style={{ background: currentPhoto?.category === "blurry" ? `linear-gradient(135deg, ${currentPhoto?.color}, ${currentPhoto?.color}22)` : `linear-gradient(135deg, ${currentPhoto?.color || "#ccc"}, ${currentPhoto?.color || "#ccc"}88)`, filter: currentPhoto?.category === "blurry" ? "blur(1.5px)" : "none" }}
              >
                <div className="w-full h-full flex flex-col items-center justify-center p-6">
                  {currentPhoto?.category === "video" ? <Video className="w-16 h-16 text-white/80 mb-3" /> : currentPhoto?.category === "blurry" ? <AlertCircle className="w-16 h-16 text-white/60 mb-3" /> : currentPhoto?.category === "livephoto" ? <Aperture className="w-16 h-16 text-white/80 mb-3" /> : <Camera className="w-16 h-16 text-white/80 mb-3" />}
                  <h3 className="text-white text-lg font-bold mb-1">{currentPhoto?.name}</h3>
                  <p className="text-white/70 text-sm">{formatSize(currentPhoto?.size || 0)}</p>
                  <p className="text-white/50 text-xs mt-1">{currentPhoto?.date ? formatDate(currentPhoto.date) : ""}</p>
                  <Badge className="mt-3 bg-white/20 text-white border-0 capitalize">{currentPhoto?.category}</Badge>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="w-full px-4 pb-8 pt-4 flex items-center justify-center gap-8">
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shadow-lg"
          onClick={() => { x.set(-200); handleSwipe("left"); setTimeout(() => x.set(0), 400); }}><X className="w-8 h-8 text-red-500" /></motion.button>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shadow-lg"
          onClick={() => { x.set(200); handleSwipe("right"); setTimeout(() => x.set(0), 400); }}><Check className="w-8 h-8 text-emerald-500" /></motion.button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CATEGORIES SCREEN (All Photos + paginated + detail + iOS confirm)
   ═══════════════════════════════════════════ */
function CategoriesScreen() {
  const { photos, categoryFilter, setCategoryFilter, deleteSelected, getStats } = useCleanupStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detailPhoto, setDetailPhoto] = useState<PhotoItem | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; ids: string[]; size: number; itemName?: string }>({ open: false, ids: [], size: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  const activePhotos = photos.filter((p) => !p.deleted);
  const filtered = categoryFilter === "allphotos"
    ? activePhotos
    : categoryFilter === "all"
    ? activePhotos.filter((p) => p.category !== "photo")
    : activePhotos.filter((p) => p.category === categoryFilter);

  // Paginated subset for performance
  const visiblePhotos = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const stats = getStats();
  const tabs: { key: CategoryFilter; label: string; count: number }[] = [
    { key: "allphotos", label: "All", count: stats.totalPhotos },
    { key: "all", label: "Clutter", count: stats.duplicates + stats.screenshots + stats.selfies + stats.largeVideos + stats.similar + stats.blurry + stats.livePhotos + stats.old },
    { key: "duplicate", label: "Dupes", count: stats.duplicates },
    { key: "screenshot", label: "Screens", count: stats.screenshots },
    { key: "selfie", label: "Selfies", count: stats.selfies },
    { key: "video", label: "Videos", count: stats.largeVideos },
    { key: "similar", label: "Similar", count: stats.similar },
    { key: "blurry", label: "Blurry", count: stats.blurry },
    { key: "livephoto", label: "Live", count: stats.livePhotos },
    { key: "old", label: "Old", count: stats.old },
  ];

  const toggleSelect = (id: string) => { const next = new Set(selected); if (next.has(id)) next.delete(id); else next.add(id); setSelected(next); };
  const selectAll = () => setSelected(new Set(filtered.map((p) => p.id)));
  const deselectAll = () => setSelected(new Set());

  const requestDelete = (ids: string[]) => {
    const photosToDelete = photos.filter((p) => ids.includes(p.id));
    const size = photosToDelete.reduce((a, p) => a + p.size, 0);
    const itemName = ids.length === 1 ? photosToDelete[0]?.name : undefined;
    setDeleteDialog({ open: true, ids, size, itemName });
  };

  const confirmDelete = () => {
    deleteSelected(deleteDialog.ids);
    setSelected(new Set());
    setDeleteDialog({ open: false, ids: [], size: 0 });
    setDetailPhoto(null);
  };

  // Infinite scroll
  const handleScroll = useCallback(() => {
    if (!gridRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = gridRef.current;
    if (scrollHeight - scrollTop - clientHeight < 400 && hasMore) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
    }
  }, [hasMore, filtered.length]);

  // Reset pagination on filter change
  const handleFilterChange = (key: CategoryFilter) => {
    setCategoryFilter(key);
    setSelected(new Set());
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-emerald-50/50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-foreground">
          {categoryFilter === "allphotos" ? "All Photos" : categoryFilter === "all" ? "Clutter" : tabs.find(t => t.key === categoryFilter)?.label || "Browse"}
        </h1>
        <p className="text-sm text-muted-foreground">{filtered.length.toLocaleString()} items &middot; {formatSize(filtered.reduce((a, p) => a + p.size, 0))}</p>
      </div>

      <div className="px-4 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button key={tab.key}
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${categoryFilter === tab.key ? "bg-emerald-600 text-white shadow-md" : "bg-card text-muted-foreground border border-border hover:bg-accent"}`}
            onClick={() => handleFilterChange(tab.key)}
          >{tab.label} ({tab.count})</button>
        ))}
      </div>

      <div className="px-4 py-1.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{selected.size > 0 ? `${selected.size} selected` : "Tap to select, double-tap to preview"}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="text-[11px] h-6 rounded-lg px-2" onClick={selectAll}>All</Button>
          <Button variant="ghost" size="sm" className="text-[11px] h-6 rounded-lg px-2" onClick={deselectAll}>None</Button>
        </div>
      </div>

      <div ref={gridRef} className="flex-1 px-2 pb-24 overflow-y-auto" onScroll={handleScroll}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-3"><Image className="w-8 h-8 text-muted-foreground" /></div>
            <p className="text-muted-foreground font-medium">No items in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {visiblePhotos.map((photo) => (
              <motion.div key={photo.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4, y: 20 }} transition={{ duration: 0.2 }}>
                <PhotoCard photo={photo} selected={selected.has(photo.id)} onToggle={() => toggleSelect(photo.id)} onOpenDetail={() => setDetailPhoto(photo)} compact />
              </motion.div>
            ))}
          </div>
        )}
        {hasMore && (
          <div className="py-4 text-center">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setVisibleCount((p) => Math.min(p + PAGE_SIZE, filtered.length))}>
              <ChevronUp className="w-3 h-3 mr-1 rotate-180" /> Load more ({(filtered.length - visibleCount).toLocaleString()} remaining)
            </Button>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <motion.div className="fixed bottom-20 left-0 right-0 px-4 pb-4" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Button size="lg" className="w-full h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold shadow-lg"
            onClick={() => requestDelete([...selected])}>
            <Trash2 className="w-5 h-5 mr-2" /> Delete {selected.size} Item{selected.size > 1 ? "s" : ""} ({formatSize(photos.filter((p) => selected.has(p.id)).reduce((a, p) => a + p.size, 0))})
          </Button>
        </motion.div>
      )}

      <IosDeleteDialog open={deleteDialog.open} count={deleteDialog.ids.length} size={deleteDialog.size} itemName={deleteDialog.itemName}
        onConfirm={confirmDelete} onCancel={() => setDeleteDialog({ open: false, ids: [], size: 0 })} />

      <PhotoDetailModal photo={detailPhoto} open={!!detailPhoto} onClose={() => setDetailPhoto(null)}
        onDelete={(id) => { requestDelete([id]); }} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   RESULTS SCREEN
   ═══════════════════════════════════════════ */
function ResultsScreen() {
  const { photos, spaceFreed, deletedCount, setScreen, resetApp } = useCleanupStore();
  const remainingPhotos = photos.filter((p) => !p.deleted);
  const remainingSize = remainingPhotos.reduce((a, p) => a + p.size, 0);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-b from-emerald-50/50 to-white dark:from-gray-950 dark:to-gray-900">
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="text-center">
        <motion.div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30"
          animate={{ rotate: [0, 10, -10, 0] }} transition={{ delay: 0.5, duration: 0.5 }}>
          <Check className="w-12 h-12 text-white" />
        </motion.div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Cleanup Complete!</h1>
        <p className="text-muted-foreground mb-8">Your library is looking much better</p>
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8">
          {[{ label: "Space Freed", value: formatSize(spaceFreed), color: "text-emerald-600" }, { label: "Items Removed", value: deletedCount.toString(), color: "text-red-500" }, { label: "Photos Kept", value: remainingPhotos.length.toString(), color: "text-foreground" }, { label: "Library Size", value: formatSize(remainingSize), color: "text-foreground" }].map((s, i) => (
            <motion.div key={s.label} className="p-4 bg-card rounded-2xl border border-border/50 shadow-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" className="rounded-2xl" onClick={() => setScreen("home")}><Home className="w-4 h-4 mr-2" /> Home</Button>
          <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={resetApp}><RefreshCw className="w-4 h-4 mr-2" /> Start Over</Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   BOTTOM NAV
   ═══════════════════════════════════════════ */
function BottomNav() {
  const { currentScreen, setScreen, photos } = useCleanupStore();
  const items: { key: Screen; icon: React.ReactNode; label: string }[] = [
    { key: "home", icon: <Home className="w-5 h-5" />, label: "Home" },
    { key: "import", icon: <Upload className="w-5 h-5" />, label: "Import" },
    { key: "swipe", icon: <HandMetal className="w-5 h-5" />, label: "Swipe" },
    { key: "categories", icon: <Grid3X3 className="w-5 h-5" />, label: "Browse" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border/50 z-50 safe-area-bottom">
      <div className="flex items-center justify-around max-w-md mx-auto h-16">
        {items.map((item) => {
          const isActive = currentScreen === item.key;
          const disabled = item.key === "swipe" && photos.filter((p) => !p.deleted && !p.kept).length === 0;
          return (
            <button key={item.key}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-all ${isActive ? "text-emerald-600" : disabled ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => !disabled && setScreen(item.key)} disabled={disabled}
            >
              <motion.div animate={isActive ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>{item.icon}</motion.div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && <motion.div layoutId="navIndicator" className="absolute -bottom-0 w-8 h-0.5 bg-emerald-600 rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════
   SCANNING OVERLAY
   ═══════════════════════════════════════════ */
function ScanningOverlay() {
  const { isScanning, isCleaning } = useCleanupStore();
  if (!isScanning && !isCleaning) return null;
  return (
    <motion.div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="bg-card rounded-3xl p-8 shadow-2xl flex flex-col items-center" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
          {isCleaning ? <Sparkles className="w-12 h-12 text-emerald-500" /> : <RefreshCw className="w-12 h-12 text-emerald-500" />}
        </motion.div>
        <p className="mt-4 font-semibold text-foreground">{isCleaning ? "Smart Cleaning..." : "Scanning..."}</p>
        <p className="text-sm text-muted-foreground mt-1">{isCleaning ? "Removing clutter from your library" : "Analyzing your photo library"}</p>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */
export default function CleanupApp() {
  const { currentScreen } = useCleanupStore();
  const screens: Record<Screen, React.ReactNode> = {
    home: <HomeScreen />, import: <ImportScreen />, swipe: <SwipeScreen />, categories: <CategoriesScreen />, results: <ResultsScreen />,
  };
  return (
    <div className="min-h-screen bg-background pb-16">
      <AnimatePresence mode="wait">
        <motion.div key={currentScreen} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {screens[currentScreen]}
        </motion.div>
      </AnimatePresence>
      <BottomNav />
      <ScanningOverlay />
    </div>
  );
}
