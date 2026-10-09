import { create } from "zustand";

import type { ModeAppearance, ModeSlug, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";

export type EditorSection = "profile" | "links" | "appearance" | "settings" | "share";
type EditableLink = Pick<ProfileLink, "id" | "title" | "url" | "is_visible" | "sort_order">;
export type EditorSnapshot = {
  profileId: string;
  profile: Pick<ProfileIdentity, "username" | "display_name" | "bio">;
  modes: { id: string; settings: ProfileMode["settings"]; appearance: ModeAppearance; links: EditableLink[] }[];
};

type EditorStore = {
  activeSlug: ModeSlug;
  section: EditorSection;
  ownerId: string | null;
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];
  setNavigation: (slug: ModeSlug, section: EditorSection) => void;
  initializeOwner: (ownerId: string) => void;
  pushUndo: (snapshot: EditorSnapshot) => void;
  undo: (current: EditorSnapshot) => EditorSnapshot | null;
  redo: (current: EditorSnapshot) => EditorSnapshot | null;
  clearHistory: () => void;
};

const HISTORY_LIMIT = 30;

export const useIdentityEditorStore = create<EditorStore>((set, get) => ({
  activeSlug: "personal",
  section: "profile",
  ownerId: null,
  undoStack: [],
  redoStack: [],
  setNavigation: (activeSlug, section) => set({ activeSlug, section }),
  initializeOwner: (ownerId) => set((state) => state.ownerId === ownerId ? {} : { ownerId, undoStack: [], redoStack: [] }),
  pushUndo: (snapshot) => set((state) => ({ undoStack: [...state.undoStack, snapshot].slice(-HISTORY_LIMIT), redoStack: [] })),
  undo: (current) => {
    const { undoStack, redoStack } = get();
    const snapshot = undoStack.at(-1);
    if (!snapshot) return null;
    set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, current].slice(-HISTORY_LIMIT) });
    return snapshot;
  },
  redo: (current) => {
    const { undoStack, redoStack } = get();
    const snapshot = redoStack.at(-1);
    if (!snapshot) return null;
    set({ redoStack: [...redoStack.slice(0, -1)], undoStack: [...undoStack, current].slice(-HISTORY_LIMIT) });
    return snapshot;
  },
  clearHistory: () => set({ undoStack: [], redoStack: [] }),
}));

export function isEditorSection(value: string): value is EditorSection {
  return value === "profile" || value === "links" || value === "appearance" || value === "settings" || value === "share";
}
