import { useState, useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  pointerWithin,
} from '@dnd-kit/core'
import type { DragStartEvent, DragMoveEvent, DragEndEvent, DragCancelEvent } from '@dnd-kit/core'
import { useUIStore } from '../../store/ui.slice'
import { useSettingsStore } from '../../store/settings.slice'
import type { AppPage, ThemeMode, RinnaiDevice, SidebarSlot } from '../../../../preload/types'
import { getSeasonalGradient } from '../../utils/seasonalGradient'

export const SIDEBAR_IMAGE_KEY = 'sidebarImage'

// ── Layout constants ─────────────────────────────────────────────────────────
const SIDEBAR_W       = 130
const BTN_H           = 80
const FLYOUT_ROWS     = 5
const FLYOUT_COLS_MAX = 4
const FLYOUT_CELL_W   = 124   // matches w-28 (112px) + gap

const NAV_PAGES: AppPage[] = [
  'calendar', 'chores', 'meals', 'photos',
  'lists', 'cameras', 'sprinklers', 'waterheater', 'tesla',
]

// ── Icons ────────────────────────────────────────────────────────────────────
const CalendarIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)
const ChoresIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
)
const ForkKnifeIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6h3.5M21 22v-7" />
  </svg>
)
const PhotosIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
  </svg>
)
const ListsIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
)
const ZzzIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
    <text x="2"  y="22" fontSize="6.5" fontWeight="900" opacity="0.5">z</text>
    <text x="8"  y="16" fontSize="8.5" fontWeight="900" opacity="0.75">z</text>
    <text x="13" y="9"  fontSize="11"  fontWeight="900">Z</text>
  </svg>
)
const SettingsIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const SunIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="5" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
)
const MoonIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
)
const AutoThemeIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" strokeLinecap="round" />
    <path strokeLinecap="round" d="M12 3a9 9 0 010 18V3z" fill="currentColor" opacity={0.25} />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
  </svg>
)
const CameraIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
  </svg>
)
const SprinklerIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 15a4 4 0 004 4h9a5 5 0 10-4.584-6.975A4.002 4.002 0 003 15z" />
  </svg>
)
const PowerwallIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <rect x="6" y="3" width="12" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" d="M10 3V2h4v1" />
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M11 9l-2 4h3l-2 4 5-6h-3l2-2h-3z" />
  </svg>
)
const WaterHeaterIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <rect x="3" y="1" width="18" height="19" rx="3" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5c0 0-3.5 3.5-3.5 6a3.5 3.5 0 007 0c0-2.5-3.5-6-3.5-6z" />
    <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
    <rect x="5.5" y="16" width="13" height="3" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="7" y1="17.5" x2="17" y2="17.5" strokeLinecap="round" />
    <path strokeLinecap="round" d="M8 20v3M16 20v3" />
  </svg>
)
const GroupIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3"  y="3"  width="8" height="8" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="13" y="3"  width="8" height="8" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3"  y="13" width="8" height="8" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PAGE_INFO: Record<AppPage, { label: string; Icon: () => JSX.Element }> = {
  calendar:    { label: 'Calendar',   Icon: CalendarIcon },
  chores:      { label: 'Chores',     Icon: ChoresIcon },
  meals:       { label: 'Meals',      Icon: ForkKnifeIcon },
  photos:      { label: 'Photos',     Icon: PhotosIcon },
  lists:       { label: 'Lists',      Icon: ListsIcon },
  cameras:     { label: 'Wyze Camera', Icon: CameraIcon },
  sprinklers:  { label: 'Sprinklers', Icon: SprinklerIcon },
  waterheater: { label: 'Water',      Icon: WaterHeaterIcon },
  tesla:       { label: 'Powerwall',  Icon: PowerwallIcon },
  settings:    { label: 'Settings',   Icon: SettingsIcon },
}

const THEME_CYCLE: ThemeMode[] = ['auto', 'light', 'dark']

// ── Drag ID encoding ─────────────────────────────────────────────────────────
type DragId =
  | { kind: 'top-item';    pageId: AppPage }
  | { kind: 'top-group';   groupId: string }
  | { kind: 'flyout-item'; pageId: AppPage; groupId: string }

const TOP_ITEM    = 'ti:'
const TOP_GROUP   = 'tg:'
const FLYOUT_ITEM = 'fi:'

function encodeDragId(d: DragId): string {
  switch (d.kind) {
    case 'top-item':    return TOP_ITEM    + d.pageId
    case 'top-group':   return TOP_GROUP   + d.groupId
    case 'flyout-item': return FLYOUT_ITEM + d.groupId + ':' + d.pageId
  }
}
function decodeDragId(s: string): DragId | null {
  if (s.startsWith(TOP_ITEM))  return { kind: 'top-item',  pageId: s.slice(TOP_ITEM.length) as AppPage }
  if (s.startsWith(TOP_GROUP)) return { kind: 'top-group', groupId: s.slice(TOP_GROUP.length) }
  if (s.startsWith(FLYOUT_ITEM)) {
    const rest = s.slice(FLYOUT_ITEM.length)
    const sep  = rest.indexOf(':')
    if (sep < 0) return null
    return { kind: 'flyout-item', groupId: rest.slice(0, sep), pageId: rest.slice(sep + 1) as AppPage }
  }
  return null
}

const TOP_DROP_PREFIX    = 'top-slot:'
const FLYOUT_DROP_PREFIX = 'flyout-slot:'
const topDropId    = (uid: string) => TOP_DROP_PREFIX + uid
const flyoutDropId = (groupId: string, pageId: AppPage) => FLYOUT_DROP_PREFIX + groupId + ':' + pageId
const slotUid = (s: SidebarSlot) => s.kind === 'item' ? s.pageId : s.id

function decodeFlyoutDropId(id: string): { groupId: string; pageId: AppPage } | null {
  if (!id.startsWith(FLYOUT_DROP_PREFIX)) return null
  const rest = id.slice(FLYOUT_DROP_PREFIX.length)
  const sep = rest.indexOf(':')
  if (sep < 0) return null
  return { groupId: rest.slice(0, sep), pageId: rest.slice(sep + 1) as AppPage }
}

// ── Reconciler — handles missing/extra pages so layout always covers everything ──
function reconcile(layout: SidebarSlot[]): SidebarSlot[] {
  const seen = new Set<AppPage>()
  const out:  SidebarSlot[] = []
  for (const slot of layout) {
    if (slot.kind === 'item') {
      if (NAV_PAGES.includes(slot.pageId) && !seen.has(slot.pageId)) {
        seen.add(slot.pageId)
        out.push(slot)
      }
    } else {
      const items = slot.items.filter((p) => NAV_PAGES.includes(p) && !seen.has(p))
      items.forEach((p) => seen.add(p))
      if (items.length >= 2) {
        out.push({ kind: 'group', id: slot.id, items })
      } else if (items.length === 1) {
        out.push({ kind: 'item', pageId: items[0] })
      }
      // empty group → drop
    }
  }
  for (const p of NAV_PAGES) {
    if (!seen.has(p)) out.push({ kind: 'item', pageId: p })
  }
  return out
}

// ── Drop intent (decided from translated rects during drag) ──────────────────
type Intent = 'before' | 'merge' | 'after'

function genGroupId(): string {
  return 'g_' + Math.random().toString(36).slice(2, 10)
}

function applyDrop(
  layout: SidebarSlot[],
  drag: DragId,
  targetUid: string,
  intent: Intent
): SidebarSlot[] {
  // Build the slot being moved
  let moving: SidebarSlot | null = null
  if (drag.kind === 'top-item') {
    moving = { kind: 'item', pageId: drag.pageId }
  } else if (drag.kind === 'top-group') {
    const g = layout.find((s) => s.kind === 'group' && s.id === drag.groupId)
    moving = g ?? null
  } else {
    moving = { kind: 'item', pageId: drag.pageId }
  }
  if (!moving) return layout

  // Remove from current position
  let next: SidebarSlot[] = layout
  if (drag.kind === 'top-item') {
    next = layout.filter((s) => !(s.kind === 'item' && s.pageId === drag.pageId))
  } else if (drag.kind === 'top-group') {
    next = layout.filter((s) => !(s.kind === 'group' && s.id === drag.groupId))
  } else {
    next = layout.map((s) =>
      s.kind === 'group' && s.id === drag.groupId
        ? { ...s, items: s.items.filter((p) => p !== drag.pageId) }
        : s
    )
  }

  // Find target after the removal
  const targetIdx = next.findIndex((s) => slotUid(s) === targetUid)
  if (targetIdx < 0) {
    // Dropped on itself or stale — append to end
    return reconcile([...next, moving])
  }
  const target = next[targetIdx]

  if (intent === 'merge') {
    const merged: AppPage[] = []
    if (target.kind === 'item') merged.push(target.pageId)
    else                        merged.push(...target.items)
    if (moving.kind === 'item') merged.push(moving.pageId)
    else                        merged.push(...moving.items)
    const dedup = Array.from(new Set(merged))
    const groupId = target.kind === 'group' ? target.id
                  : moving.kind === 'group' ? moving.id
                  : genGroupId()
    const newGroup: SidebarSlot = { kind: 'group', id: groupId, items: dedup }
    next = [...next.slice(0, targetIdx), newGroup, ...next.slice(targetIdx + 1)]
    return reconcile(next)
  }

  // before / after
  const insertAt = targetIdx + (intent === 'after' ? 1 : 0)
  next = [...next.slice(0, insertAt), moving, ...next.slice(insertAt)]
  return reconcile(next)
}

/**
 * Drop a dragged tile onto a specific slot inside an open flyout. Lets the
 * user reorder within a group, move a tile from one group's flyout to
 * another group, or drag a top-level item / group into a group's flyout.
 */
function applyDropToFlyout(
  layout: SidebarSlot[],
  drag: DragId,
  targetGroupId: string,
  targetPageId: AppPage,
  intent: 'before' | 'after',
): SidebarSlot[] {
  // Pages being added (single page for items / flyout-items, all of a group's pages for top-group)
  let pagesToAdd: AppPage[] = []
  if (drag.kind === 'top-item') {
    pagesToAdd = [drag.pageId]
  } else if (drag.kind === 'flyout-item') {
    pagesToAdd = [drag.pageId]
  } else if (drag.kind === 'top-group') {
    const g = layout.find((s) => s.kind === 'group' && s.id === drag.groupId)
    if (g?.kind === 'group') pagesToAdd = g.items
  }
  if (pagesToAdd.length === 0) return layout

  // Remove from source
  let next: SidebarSlot[]
  if (drag.kind === 'top-item') {
    next = layout.filter((s) => !(s.kind === 'item' && s.pageId === drag.pageId))
  } else if (drag.kind === 'top-group') {
    next = layout.filter((s) => !(s.kind === 'group' && s.id === drag.groupId))
  } else {
    next = layout.map((s) =>
      s.kind === 'group' && s.id === drag.groupId
        ? { ...s, items: s.items.filter((p) => p !== drag.pageId) }
        : s
    )
  }

  // Insert into target group at the position relative to targetPageId
  next = next.map((s) => {
    if (s.kind !== 'group' || s.id !== targetGroupId) return s
    const filtered = s.items.filter((p) => !pagesToAdd.includes(p))
    const idx = filtered.indexOf(targetPageId)
    const insertAt = idx >= 0 ? idx + (intent === 'after' ? 1 : 0) : filtered.length
    return {
      ...s,
      items: [...filtered.slice(0, insertAt), ...pagesToAdd, ...filtered.slice(insertAt)],
    }
  })

  return reconcile(next)
}

// ── Shared button style ──────────────────────────────────────────────────────
const btnBase = `
  flex flex-col items-center justify-center gap-1.5 w-28 h-20 rounded-xl
  transition-colors duration-150 min-h-[80px] text-xs font-medium relative z-10
`

// ── Item / group inner content ──────────────────────────────────────────────
function ItemContents({ pageId, recircActive }: { pageId: AppPage; recircActive: boolean }) {
  const { Icon, label } = PAGE_INFO[pageId]
  const showRecircBadge = pageId === 'waterheater' && recircActive
  return (
    <>
      <div className="relative">
        <Icon />
        {showRecircBadge && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
            style={{
              background: 'radial-gradient(circle at 40% 40%, #fca5a5, #ef4444)',
              boxShadow: '0 0 6px rgba(239,68,68,0.8)',
            }}
          />
        )}
      </div>
      <span>{label}</span>
    </>
  )
}

function GroupContents() {
  return (
    <div className="relative">
      <GroupIcon />
    </div>
  )
}

// ── Top-level draggable+droppable slot ───────────────────────────────────────
function TopSlot({
  slot,
  isActive,
  recircActive,
  chipFill,
  intent,
  onClick,
}: {
  slot: SidebarSlot
  isActive: boolean
  recircActive: boolean
  chipFill: boolean
  intent: Intent | null
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const dragId: DragId =
    slot.kind === 'item'
      ? { kind: 'top-item', pageId: slot.pageId }
      : { kind: 'top-group', groupId: slot.id }

  const draggable = useDraggable({ id: encodeDragId(dragId) })
  const droppable = useDroppable({ id: topDropId(slotUid(slot)) })

  const setRef = (el: HTMLElement | null) => {
    draggable.setNodeRef(el)
    droppable.setNodeRef(el)
  }

  return (
    <div className="relative" style={{ width: '100%' }}>
      {/* Drop indicator: line above */}
      {intent === 'before' && (
        <div className="absolute -top-1 left-2 right-2 h-1 bg-blue-400 rounded-full pointer-events-none z-20" />
      )}

      <div className="flex justify-center">
        <button
          ref={setRef as any}
          {...draggable.attributes}
          {...draggable.listeners}
          onClick={onClick}
          className={`${btnBase} ${
            isActive
              ? 'bg-blue-500 text-white'
              : chipFill
                ? 'text-[var(--text-sidebar)]'
                : 'text-[var(--text-sidebar)] hover:bg-[var(--sidebar-hover)] opacity-70 hover:opacity-100'
          } ${draggable.isDragging ? 'opacity-30' : ''}`}
          style={{ touchAction: 'none', ...(chipFill && !isActive ? { background: 'var(--chip-bg)' } : {}) }}
          aria-label={slot.kind === 'item' ? PAGE_INFO[slot.pageId].label : 'Group'}
        >
          {slot.kind === 'item'
            ? <ItemContents pageId={slot.pageId} recircActive={recircActive} />
            : <GroupContents />}
        </button>
      </div>

      {/* Drop indicator: ring for merge */}
      {intent === 'merge' && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bottom-0 mx-2 my-0 rounded-xl ring-2 ring-blue-400 z-20"
          style={{ boxShadow: '0 0 12px rgba(96,165,250,0.7)' }}
        />
      )}

      {/* Drop indicator: line below */}
      {intent === 'after' && (
        <div className="absolute -bottom-1 left-2 right-2 h-1 bg-blue-400 rounded-full pointer-events-none z-20" />
      )}
    </div>
  )
}

// ── Flyout item (inside the open group) — both draggable and droppable ──────
function FlyoutItem({
  pageId,
  groupId,
  isActive,
  recircActive,
  intent,
  onClick,
}: {
  pageId:       AppPage
  groupId:      string
  isActive:     boolean
  recircActive: boolean
  intent:       'before' | 'after' | null
  onClick:      () => void
}) {
  const dragId: DragId = { kind: 'flyout-item', pageId, groupId }
  const draggable = useDraggable({ id: encodeDragId(dragId) })
  const droppable = useDroppable({ id: flyoutDropId(groupId, pageId) })

  const setRef = (el: HTMLElement | null) => {
    draggable.setNodeRef(el)
    droppable.setNodeRef(el)
  }

  return (
    <div className="relative">
      {intent === 'before' && (
        <div className="absolute -top-1 left-2 right-2 h-1 bg-blue-400 rounded-full pointer-events-none z-20" />
      )}
      <button
        ref={setRef as any}
        {...draggable.attributes}
        {...draggable.listeners}
        onClick={onClick}
        className={`${btnBase} ${
          isActive
            ? 'bg-blue-500 text-white'
            : 'text-[var(--text-sidebar)] hover:bg-[var(--sidebar-hover)] opacity-80 hover:opacity-100'
        } ${draggable.isDragging ? 'opacity-30' : ''}`}
        style={{ touchAction: 'none' }}
        aria-label={PAGE_INFO[pageId].label}
      >
        <ItemContents pageId={pageId} recircActive={recircActive} />
      </button>
      {intent === 'after' && (
        <div className="absolute -bottom-1 left-2 right-2 h-1 bg-blue-400 rounded-full pointer-events-none z-20" />
      )}
    </div>
  )
}

// ── Flyout panel ────────────────────────────────────────────────────────────
function GroupFlyout({
  group,
  anchorTop,
  activePage,
  recircActive,
  flyoutOver,
  onItemClick,
}: {
  group:        Extract<SidebarSlot, { kind: 'group' }>
  anchorTop:    number
  activePage:   AppPage
  recircActive: boolean
  flyoutOver:   { groupId: string; pageId: AppPage; intent: 'before' | 'after' } | null
  onItemClick:  (p: AppPage) => void
}) {
  const cols = Math.min(FLYOUT_COLS_MAX, Math.max(1, Math.ceil(group.items.length / FLYOUT_ROWS)))

  return (
    <div
      className="absolute z-40 p-2 rounded-r-2xl shadow-2xl"
      style={{
        left:       SIDEBAR_W,
        top:        anchorTop,
        width:      cols * FLYOUT_CELL_W + 8,
        background: 'var(--bg-sidebar)',
        border:     '1px solid var(--border-sidebar)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display:           'grid',
          gridTemplateRows:  `repeat(${FLYOUT_ROWS}, ${BTN_H}px)`,
          gridAutoFlow:      'column',
          gridAutoColumns:   `${FLYOUT_CELL_W}px`,
          gap:               '4px',
          justifyItems:      'center',
        }}
      >
        {group.items.map((pageId) => {
          const intent =
            flyoutOver && flyoutOver.groupId === group.id && flyoutOver.pageId === pageId
              ? flyoutOver.intent
              : null
          return (
            <FlyoutItem
              key={pageId}
              pageId={pageId}
              groupId={group.id}
              isActive={activePage === pageId}
              recircActive={recircActive}
              intent={intent}
              onClick={() => onItemClick(pageId)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function Sidebar() {
  const activePage   = useUIStore((s) => s.activePage)
  const setPage      = useUIStore((s) => s.setPage)
  const setMode      = useUIStore((s) => s.setMode)
  const themeMode    = useSettingsStore((s) => s.themeMode)
  const setThemeMode = useSettingsStore((s) => s.setThemeMode)
  const fullscreenArt = useSettingsStore((s) => s.artMode === 'fullscreen')
  const artIconFill   = useSettingsStore((s) => s.artIconFill)
  // Rounded backdrop chips behind nav items — only over fullscreen art.
  const chipFill = fullscreenArt && artIconFill

  const sidebarLayoutRaw = useSettingsStore((s) => s.sidebarLayout)
  const setSidebarLayout = useSettingsStore((s) => s.setSidebarLayout)
  const layout = useMemo(() => reconcile(sidebarLayoutRaw), [sidebarLayoutRaw])

  const qc            = useQueryClient()
  const rinnaiDevices = qc.getQueryData<RinnaiDevice[]>(['rinnai-devices']) ?? []
  const recircActive  = rinnaiDevices.some((d) => d.recirculationEnabled)

  // ── Sidebar background image (managed in Settings → General) ──
  const [sidebarImageRaw, setSidebarImage] = useState<string | null>(
    () => localStorage.getItem(SIDEBAR_IMAGE_KEY)
  )
  useEffect(() => {
    const handler = () => setSidebarImage(localStorage.getItem(SIDEBAR_IMAGE_KEY))
    window.addEventListener('sidebarImageChanged', handler)
    return () => window.removeEventListener('sidebarImageChanged', handler)
  }, [])
  // In fullscreen art mode the strip image is suppressed so the art shows through.
  const sidebarImage = fullscreenArt ? null : sidebarImageRaw

  // ── DnD state ──
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overUid,      setOverUid]      = useState<string | null>(null)
  const [overIntent,   setOverIntent]   = useState<Intent | null>(null)
  const [flyoutOver,   setFlyoutOver]   = useState<
    { groupId: string; pageId: AppPage; intent: 'before' | 'after' } | null
  >(null)

  // ── Group flyout state ──
  const [openGroupId,    setOpenGroupId]    = useState<string | null>(null)
  const [openGroupTop,   setOpenGroupTop]   = useState<number>(0)
  const navRef = useRef<HTMLElement | null>(null)

  // Close flyout if its group disappears (e.g. last item removed)
  useEffect(() => {
    if (openGroupId && !layout.some((s) => s.kind === 'group' && s.id === openGroupId)) {
      setOpenGroupId(null)
    }
  }, [layout, openGroupId])

  // Click-outside / Escape closes flyout
  useEffect(() => {
    if (!openGroupId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenGroupId(null) }
    const onPointerDown = (e: PointerEvent) => {
      const nav = navRef.current
      if (!nav) return
      const t = e.target as Node
      // Click inside the nav (sidebar) is fine. Click on the flyout is fine
      // (flyout is positioned inside nav so this case is covered).
      if (nav.contains(t)) return
      setOpenGroupId(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [openGroupId])

  // ── Sensors ──
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  // ── Drag handlers ──
  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id))
  }

  /** Compute intent from the dragged element's center vs the over rect. */
  const computeIntent = (e: DragMoveEvent | DragEndEvent): { rel: number } | null => {
    const { over, active } = e
    if (!over) return null
    const overTop    = over.rect.top
    const overHeight = over.rect.height
    const draggedTop = active.rect.current.translated?.top
                    ?? active.rect.current.initial?.top ?? 0
    const draggedH   = active.rect.current.initial?.height ?? overHeight
    const draggedCY  = draggedTop + draggedH / 2
    const overCY     = overTop + overHeight / 2
    return { rel: (draggedCY - overCY) / overHeight }   // -0.5 .. 0.5
  }

  const clearOver = () => {
    setOverUid(null); setOverIntent(null); setFlyoutOver(null)
  }

  const handleDragMove = (e: DragMoveEvent) => {
    const { over, active } = e
    if (!over) { clearOver(); return }
    const overId = String(over.id)
    const drag   = decodeDragId(String(active.id))
    if (!drag) { clearOver(); return }

    const r = computeIntent(e)
    if (!r) { clearOver(); return }

    if (overId.startsWith(TOP_DROP_PREFIX)) {
      const uid = overId.slice(TOP_DROP_PREFIX.length)
      if (drag.kind === 'top-item'  && drag.pageId  === uid) { clearOver(); return }
      if (drag.kind === 'top-group' && drag.groupId === uid) { clearOver(); return }

      let intent: Intent
      if      (r.rel < -0.25) intent = 'before'
      else if (r.rel >  0.25) intent = 'after'
      else                    intent = 'merge'
      setOverUid(uid); setOverIntent(intent); setFlyoutOver(null)
      return
    }

    if (overId.startsWith(FLYOUT_DROP_PREFIX)) {
      const decoded = decodeFlyoutDropId(overId)
      if (!decoded) { clearOver(); return }
      // Self-drops are no-ops
      if (drag.kind === 'flyout-item'
          && drag.groupId === decoded.groupId
          && drag.pageId  === decoded.pageId) { clearOver(); return }
      const intent: 'before' | 'after' = r.rel < 0 ? 'before' : 'after'
      setOverUid(null); setOverIntent(null)
      setFlyoutOver({ groupId: decoded.groupId, pageId: decoded.pageId, intent })
      return
    }

    clearOver()
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const drag = decodeDragId(String(e.active.id))
    setActiveDragId(null); clearOver()
    if (!drag || !e.over) return
    const overId = String(e.over.id)
    const r = computeIntent(e)
    if (!r) return

    if (overId.startsWith(TOP_DROP_PREFIX)) {
      const uid = overId.slice(TOP_DROP_PREFIX.length)
      if (drag.kind === 'top-item'  && drag.pageId  === uid) return
      if (drag.kind === 'top-group' && drag.groupId === uid) return
      let intent: Intent
      if      (r.rel < -0.25) intent = 'before'
      else if (r.rel >  0.25) intent = 'after'
      else                    intent = 'merge'
      const next = applyDrop(layout, drag, uid, intent)
      if (next !== layout) setSidebarLayout(next)
      return
    }

    if (overId.startsWith(FLYOUT_DROP_PREFIX)) {
      const decoded = decodeFlyoutDropId(overId)
      if (!decoded) return
      if (drag.kind === 'flyout-item'
          && drag.groupId === decoded.groupId
          && drag.pageId  === decoded.pageId) return
      const intent: 'before' | 'after' = r.rel < 0 ? 'before' : 'after'
      const next = applyDropToFlyout(layout, drag, decoded.groupId, decoded.pageId, intent)
      if (next !== layout) setSidebarLayout(next)
      return
    }
  }

  const handleDragCancel = (_e: DragCancelEvent) => {
    setActiveDragId(null); clearOver()
  }

  // ── Click handlers ──
  const handleGroupClick = (groupId: string, btn: HTMLElement) => {
    if (openGroupId === groupId) { setOpenGroupId(null); return }
    const nav = navRef.current
    if (!nav) return
    const navRect = nav.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    const top = Math.max(0, btnRect.top - navRect.top - 2 * BTN_H)
    setOpenGroupTop(top)
    setOpenGroupId(groupId)
  }

  // ── Theme toggle ──
  const handleThemeToggle = () => {
    const idx = THEME_CYCLE.indexOf(themeMode)
    setThemeMode(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length])
  }
  const ThemeIcon = themeMode === 'dark' ? MoonIcon : themeMode === 'light' ? SunIcon : AutoThemeIcon
  const themeLabel = themeMode === 'dark' ? 'Dark' : themeMode === 'light' ? 'Light' : 'Auto'

  const seasonalGradient = getSeasonalGradient(new Date().getMonth())
  const openGroup = openGroupId
    ? layout.find((s) => s.kind === 'group' && s.id === openGroupId) as Extract<SidebarSlot, { kind: 'group' }> | undefined
    : undefined

  // ── DragOverlay preview ──
  let overlayContent: React.ReactNode = null
  if (activeDragId) {
    const drag = decodeDragId(activeDragId)
    if (drag?.kind === 'top-item' || drag?.kind === 'flyout-item') {
      overlayContent = (
        <div className={`${btnBase} bg-blue-500/90 text-white shadow-2xl`}>
          <ItemContents pageId={drag.pageId} recircActive={recircActive} />
        </div>
      )
    } else if (drag?.kind === 'top-group') {
      overlayContent = (
        <div className={`${btnBase} bg-[var(--bg-sidebar)] text-[var(--text-sidebar)] shadow-2xl border border-white/10`}>
          <GroupContents />
        </div>
      )
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <nav
        ref={navRef}
        className="flex flex-col items-center py-3 gap-1 flex-shrink-0 relative"
        style={{
          width: SIDEBAR_W,
          background: sidebarImage ? 'transparent' : 'var(--bg-sidebar-panel)',
          borderRight: '1px solid var(--border-sidebar)',
          // overflow visible so the group flyout can extend to the right
          overflow: 'visible',
        }}
      >
        {/* ── Background image ── */}
        {sidebarImage && (
          <>
            <img
              src={sidebarImage}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 w-full h-full object-cover"
              style={{ zIndex: 0, clipPath: 'inset(0 0 0 0)' }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1 }}
            />
          </>
        )}

        {/* ── Seasonal gradient — suppressed in fullscreen art mode ── */}
        {!sidebarImage && !fullscreenArt && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: seasonalGradient, zIndex: 1 }}
          />
        )}

        {/* Main nav (sortable) */}
        {layout.map((slot) => {
          const uid = slotUid(slot)
          const isActive =
            slot.kind === 'item'
              ? activePage === slot.pageId
              : slot.kind === 'group' && slot.id === openGroupId  // group-button highlighted while flyout open
          const intent = (overUid === uid) ? overIntent : null

          return (
            <TopSlot
              key={slot.kind === 'item' ? 'i:' + slot.pageId : 'g:' + slot.id}
              slot={slot}
              isActive={isActive}
              recircActive={recircActive}
              chipFill={chipFill}
              intent={intent}
              onClick={(e) => {
                if (slot.kind === 'item') {
                  setOpenGroupId(null)
                  setPage(slot.pageId)
                } else {
                  handleGroupClick(slot.id, e.currentTarget)
                }
              }}
            />
          )
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Theme toggle */}
        <button
          onClick={handleThemeToggle}
          className={`${btnBase} text-[var(--text-sidebar)] ${chipFill ? '' : 'hover:bg-[var(--sidebar-hover)] opacity-70 hover:opacity-100'}`}
          style={chipFill ? { background: 'var(--chip-bg)' } : undefined}
          aria-label={`Theme: ${themeLabel}`}
          title={`Theme: ${themeLabel} — click to cycle`}
        >
          <ThemeIcon />
          <span>{themeLabel}</span>
        </button>

        {/* Sleep */}
        <button
          onClick={() => setMode('standby')}
          className={`${btnBase} text-[var(--text-sidebar)] ${chipFill ? '' : 'hover:bg-[var(--sidebar-hover)] opacity-60 hover:opacity-100'}`}
          style={chipFill ? { background: 'var(--chip-bg)' } : undefined}
          aria-label="Sleep / Standby"
        >
          <ZzzIcon />
          <span>Sleep</span>
        </button>

        {/* Settings */}
        <button
          onClick={() => { setOpenGroupId(null); setPage('settings') }}
          className={`${btnBase} ${
            activePage === 'settings'
              ? 'bg-blue-500 text-white'
              : chipFill
                ? 'text-[var(--text-sidebar)]'
                : 'text-[var(--text-sidebar)] hover:bg-[var(--sidebar-hover)] opacity-70 hover:opacity-100'
          }`}
          style={chipFill && activePage !== 'settings' ? { background: 'var(--chip-bg)' } : undefined}
          aria-label="Settings"
        >
          <SettingsIcon />
          <span>Settings</span>
        </button>

        {/* Group flyout (rendered inside nav so click-outside detection works) */}
        {openGroup && (
          <GroupFlyout
            group={openGroup}
            anchorTop={openGroupTop}
            activePage={activePage}
            recircActive={recircActive}
            flyoutOver={flyoutOver}
            onItemClick={(p) => {
              setOpenGroupId(null)
              setPage(p)
            }}
          />
        )}
      </nav>

      <DragOverlay dropAnimation={null}>{overlayContent}</DragOverlay>
    </DndContext>
  )
}
