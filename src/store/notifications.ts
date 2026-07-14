// notifications slice: the bell feed. Klippy faults, '!!' gcode errors, and
// failed sends land here; the top-bar bell shows the unread count and the
// dropdown lists the latest.

import type { StateCreator } from 'zustand';
import type { LiveStore } from './index';

export type NoticeKind = 'error' | 'warning' | 'info';

export interface AppNotice {
  id: number;
  t: string;          // HH:MM:SS arrival time
  kind: NoticeKind;
  text: string;
}

export interface NotificationsSlice {
  notices: AppNotice[];
  unread: number;
  pushNotice: (kind: NoticeKind, text: string) => void;
  markNoticesRead: () => void;
  clearNotices: () => void;
}

let nextNoticeId = 1;

export const createNotificationsSlice: StateCreator<LiveStore, [], [], NotificationsSlice> = (set) => ({
  notices: [],
  unread: 0,
  pushNotice: (kind, text) =>
    set((s) => {
      // Collapse exact repeats (temperature faults repost identical lines).
      if (s.notices[0]?.text === text) return {};
      const notice: AppNotice = { id: nextNoticeId++, t: new Date().toTimeString().slice(0, 8), kind, text };
      return { notices: [notice, ...s.notices].slice(0, 50), unread: s.unread + 1 };
    }),
  markNoticesRead: () => set({ unread: 0 }),
  clearNotices: () => set({ notices: [], unread: 0 }),
});
