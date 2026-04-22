"use client";

import { create } from "zustand";

export type PhotoCategory = "photo" | "screenshot" | "selfie" | "video" | "duplicate" | "similar" | "blurry" | "livephoto" | "old";
export type Screen = "home" | "import" | "swipe" | "categories" | "results";
export type CategoryFilter = PhotoCategory | "all" | "allphotos";

export interface PhotoItem {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
  width: number;
  height: number;
  category: PhotoCategory;
  kept: boolean;
  deleted: boolean;
  deleting: boolean; // for immediate visual feedback animation
  duplicateGroupId: string | null;
  color: string;
  date: string;
}

interface CleanupStore {
  photos: PhotoItem[];
  currentScreen: Screen;
  swipeIndex: number;
  spaceFreed: number;
  deletedCount: number;
  categoryFilter: CategoryFilter;
  isScanning: boolean;
  isCleaning: boolean;
  demoLoaded: boolean;

  setScreen: (screen: Screen) => void;
  addPhotos: (photos: PhotoItem[]) => void;
  setSwipeIndex: (index: number) => void;
  markAsKept: (id: string) => void;
  markAsDeleted: (id: string) => void;
  deleteSelected: (ids: string[]) => void;
  smartClean: () => void;
  setCategoryFilter: (filter: CategoryFilter) => void;
  setIsScanning: (val: boolean) => void;
  setIsCleaning: (val: boolean) => void;
  loadDemoPhotos: () => void;
  resetApp: () => void;
  getActivePhotos: () => PhotoItem[];
  getPhotosByCategory: (cat: PhotoCategory) => PhotoItem[];
  getDuplicates: () => Map<string, PhotoItem[]>;
  getStats: () => {
    totalPhotos: number;
    totalSize: number;
    duplicates: number;
    screenshots: number;
    selfies: number;
    largeVideos: number;
    similar: number;
    blurry: number;
    livePhotos: number;
    old: number;
    reclaimable: number;
    keptCount: number;
    deletedCount: number;
  };
}

const COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#22C55E",
  "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E",
  "#FB923C", "#FBBF24", "#A3E635", "#4ADE80", "#2DD4BF",
  "#22D3EE", "#38BDF8", "#818CF8", "#C084FC", "#E879F9",
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function generateColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// BLURRY colors: muted, washed-out pastels to simulate blurry photos
const BLURRY_COLORS = ["#D4D4D4", "#E5E5E5", "#D1D5DB", "#D6D3D1", "#CBD5E1", "#C4B5A0", "#B8C4C0", "#C9C2B0"];
function generateBlurryColor(): string {
  return BLURRY_COLORS[Math.floor(Math.random() * BLURRY_COLORS.length)];
}

function generateDemoPhotos(): PhotoItem[] {
  const photos: PhotoItem[] = [];
  const now = Date.now();

  // Regular photos - increased count for larger library feel
  for (let i = 0; i < 25; i++) {
    const isLandscape = Math.random() > 0.5;
    photos.push({
      id: generateId(),
      url: "",
      name: `IMG_${1000 + i}.jpg`,
      size: Math.floor(Math.random() * 4 * 1024 * 1024) + 500 * 1024,
      type: "image/jpeg",
      width: isLandscape ? 4032 : 3024,
      height: isLandscape ? 3024 : 4032,
      category: "photo",
      kept: false,
      deleted: false,
      deleting: false,
      duplicateGroupId: null,
      color: generateColor(),
      date: new Date(now - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Duplicate groups (4 groups)
  for (let g = 0; g < 4; g++) {
    const groupId = `dup_group_${g}`;
    const baseSize = Math.floor(Math.random() * 3 * 1024 * 1024) + 1 * 1024 * 1024;
    const baseColor = generateColor();
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      photos.push({
        id: generateId(),
        url: "",
        name: `IMG_${2000 + g * 10 + i}.jpg`,
        size: baseSize + Math.floor(Math.random() * 100 * 1024),
        type: "image/jpeg",
        width: 3024,
        height: 4032,
        category: "duplicate",
        kept: false,
        deleted: false,
        deleting: false,
        duplicateGroupId: groupId,
        color: baseColor,
        date: new Date(now - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  // Similar photos (3 groups)
  for (let g = 0; g < 3; g++) {
    const groupId = `sim_group_${g}`;
    const baseColor = COLORS[g * 5];
    const count = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      photos.push({
        id: generateId(),
        url: "",
        name: `IMG_${3000 + g * 10 + i}.jpg`,
        size: Math.floor(Math.random() * 2 * 1024 * 1024) + 800 * 1024,
        type: "image/jpeg",
        width: 3024,
        height: 4032,
        category: "similar",
        kept: false,
        deleted: false,
        deleting: false,
        duplicateGroupId: groupId,
        color: baseColor,
        date: new Date(now - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  // Screenshots
  for (let i = 0; i < 10; i++) {
    photos.push({
      id: generateId(),
      url: "",
      name: `Screenshot_${4000 + i}.png`,
      size: Math.floor(Math.random() * 500 * 1024) + 100 * 1024,
      type: "image/png",
      width: 1170,
      height: 2532,
      category: "screenshot",
      kept: false,
      deleted: false,
      deleting: false,
      duplicateGroupId: null,
      color: generateColor(),
      date: new Date(now - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Selfies
  for (let i = 0; i < 8; i++) {
    photos.push({
      id: generateId(),
      url: "",
      name: `Selfie_${5000 + i}.jpg`,
      size: Math.floor(Math.random() * 3 * 1024 * 1024) + 1 * 1024 * 1024,
      type: "image/jpeg",
      width: 3024,
      height: 4032,
      category: "selfie",
      kept: false,
      deleted: false,
      deleting: false,
      duplicateGroupId: null,
      color: generateColor(),
      date: new Date(now - Math.random() * 45 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Large Videos
  for (let i = 0; i < 4; i++) {
    photos.push({
      id: generateId(),
      url: "",
      name: `VID_${6000 + i}.mov`,
      size: Math.floor(Math.random() * 200 * 1024 * 1024) + 50 * 1024 * 1024,
      type: "video/quicktime",
      width: 1920,
      height: 1080,
      category: "video",
      kept: false,
      deleted: false,
      deleting: false,
      duplicateGroupId: null,
      color: generateColor(),
      date: new Date(now - Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Blurry photos - NEW CATEGORY
  for (let i = 0; i < 7; i++) {
    photos.push({
      id: generateId(),
      url: "",
      name: `IMG_${7000 + i}.jpg`,
      size: Math.floor(Math.random() * 2 * 1024 * 1024) + 200 * 1024,
      type: "image/jpeg",
      width: 3024,
      height: 4032,
      category: "blurry",
      kept: false,
      deleted: false,
      deleting: false,
      duplicateGroupId: null,
      color: generateBlurryColor(),
      date: new Date(now - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Live Photos - NEW CATEGORY
  for (let i = 0; i < 5; i++) {
    photos.push({
      id: generateId(),
      url: "",
      name: `IMG_${8000 + i}_LP.jpg`,
      size: Math.floor(Math.random() * 3 * 1024 * 1024) + 2 * 1024 * 1024,
      type: "image/jpeg",
      width: 3024,
      height: 4032,
      category: "livephoto",
      kept: false,
      deleted: false,
      deleting: false,
      duplicateGroupId: null,
      color: generateColor(),
      date: new Date(now - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Old photos (>1 year) - NEW CATEGORY
  for (let i = 0; i < 6; i++) {
    photos.push({
      id: generateId(),
      url: "",
      name: `IMG_${9000 + i}.jpg`,
      size: Math.floor(Math.random() * 2 * 1024 * 1024) + 800 * 1024,
      type: "image/jpeg",
      width: 3024,
      height: 4032,
      category: "old",
      kept: false,
      deleted: false,
      deleting: false,
      duplicateGroupId: null,
      color: generateColor(),
      date: new Date(now - (365 + Math.random() * 365) * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return photos;
}

export const useCleanupStore = create<CleanupStore>((set, get) => ({
  photos: [],
  currentScreen: "home",
  swipeIndex: 0,
  spaceFreed: 0,
  deletedCount: 0,
  categoryFilter: "all",
  isScanning: false,
  isCleaning: false,
  demoLoaded: false,

  setScreen: (screen) => set({ currentScreen: screen }),
  addPhotos: (photos) =>
    set((state) => ({ photos: [...state.photos, ...photos] })),
  setSwipeIndex: (index) => set({ swipeIndex: index }),
  markAsKept: (id) =>
    set((state) => ({
      photos: state.photos.map((p) => (p.id === id ? { ...p, kept: true } : p)),
    })),
  markAsDeleted: (id) =>
    set((state) => {
      const photo = state.photos.find((p) => p.id === id);
      if (!photo || photo.deleted) return state;
      return {
        photos: state.photos.map((p) =>
          p.id === id ? { ...p, deleted: true, deleting: false } : p
        ),
        spaceFreed: state.spaceFreed + (photo?.size || 0),
        deletedCount: state.deletedCount + 1,
      };
    }),
  deleteSelected: (ids) =>
    set((state) => {
      const selectedPhotos = state.photos.filter((p) => ids.includes(p.id) && !p.deleted);
      const totalSize = selectedPhotos.reduce((acc, p) => acc + p.size, 0);
      return {
        photos: state.photos.map((p) =>
          ids.includes(p.id) ? { ...p, deleted: true, deleting: false } : p
        ),
        spaceFreed: state.spaceFreed + totalSize,
        deletedCount: state.deletedCount + selectedPhotos.length,
      };
    }),
  smartClean: () => {
    const state = get();
    const toDelete: string[] = [];

    // Delete all screenshots
    state.photos.forEach((p) => {
      if (p.category === "screenshot" && !p.deleted) toDelete.push(p.id);
    });

    // Delete blurry photos
    state.photos.forEach((p) => {
      if (p.category === "blurry" && !p.deleted) toDelete.push(p.id);
    });

    // From each duplicate group, keep the first, delete the rest
    const groups = new Map<string, PhotoItem[]>();
    state.photos
      .filter((p) => p.duplicateGroupId && !p.deleted)
      .forEach((p) => {
        if (!groups.has(p.duplicateGroupId!)) groups.set(p.duplicateGroupId!, []);
        groups.get(p.duplicateGroupId!)!.push(p);
      });
    groups.forEach((items) => {
      items.slice(1).forEach((p) => toDelete.push(p.id));
    });

    // Delete similar photos (keep first of each group)
    const simGroups = new Map<string, PhotoItem[]>();
    state.photos
      .filter((p) => p.category === "similar" && !p.deleted)
      .forEach((p) => {
        if (!p.duplicateGroupId) {
          toDelete.push(p.id);
        } else {
          if (!simGroups.has(p.duplicateGroupId)) simGroups.set(p.duplicateGroupId, []);
          simGroups.get(p.duplicateGroupId)!.push(p);
        }
      });
    simGroups.forEach((items) => {
      items.slice(1).forEach((p) => toDelete.push(p.id));
    });

    // Delete large videos
    state.photos.forEach((p) => {
      if (p.category === "video" && !p.deleted) toDelete.push(p.id);
    });

    const uniqueToDelete = [...new Set(toDelete)];
    const totalSize = state.photos
      .filter((p) => uniqueToDelete.includes(p.id))
      .reduce((acc, p) => acc + p.size, 0);

    set({
      photos: state.photos.map((p) =>
        uniqueToDelete.includes(p.id) ? { ...p, deleted: true, deleting: false } : p
      ),
      spaceFreed: state.spaceFreed + totalSize,
      deletedCount: state.deletedCount + uniqueToDelete.length,
      isCleaning: false,
      currentScreen: "results",
    });
  },
  setCategoryFilter: (filter) => set({ categoryFilter: filter }),
  setIsScanning: (val) => set({ isScanning: val }),
  setIsCleaning: (val) => set({ isCleaning: val }),
  loadDemoPhotos: () => {
    const demoPhotos = generateDemoPhotos();
    set({ photos: demoPhotos, demoLoaded: true });
  },
  resetApp: () =>
    set({
      photos: [],
      currentScreen: "home",
      swipeIndex: 0,
      spaceFreed: 0,
      deletedCount: 0,
      categoryFilter: "all",
      isScanning: false,
      isCleaning: false,
      demoLoaded: false,
    }),
  getActivePhotos: () => get().photos.filter((p) => !p.deleted),
  getPhotosByCategory: (cat) => get().photos.filter((p) => p.category === cat && !p.deleted),
  getDuplicates: () => {
    const map = new Map<string, PhotoItem[]>();
    get()
      .photos.filter((p) => p.duplicateGroupId && !p.deleted)
      .forEach((p) => {
        if (!map.has(p.duplicateGroupId!)) map.set(p.duplicateGroupId!, []);
        map.get(p.duplicateGroupId!)!.push(p);
      });
    return map;
  },
  getStats: () => {
    const photos = get().photos;
    const active = photos.filter((p) => !p.deleted);
    const deleted = photos.filter((p) => p.deleted);
    return {
      totalPhotos: active.length,
      totalSize: active.reduce((acc, p) => acc + p.size, 0),
      duplicates: active.filter((p) => p.category === "duplicate").length,
      screenshots: active.filter((p) => p.category === "screenshot").length,
      selfies: active.filter((p) => p.category === "selfie").length,
      largeVideos: active.filter((p) => p.category === "video").length,
      similar: active.filter((p) => p.category === "similar").length,
      blurry: active.filter((p) => p.category === "blurry").length,
      livePhotos: active.filter((p) => p.category === "livephoto").length,
      old: active.filter((p) => p.category === "old").length,
      reclaimable: active
        .filter((p) => p.category !== "photo")
        .reduce((acc, p) => acc + p.size, 0),
      keptCount: active.filter((p) => p.kept).length,
      deletedCount: deleted.length,
    };
  },
}));
