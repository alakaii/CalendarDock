// Shared shell layout constants.
//
// These mirror the fixed dimensions the real shell renders at, so other
// surfaces (e.g. the standby "slideshow in the calendar window" mode) can
// reproduce the calendar-area rect WITHOUT mounting the actual Sidebar /
// AppHeader components.
//
//   SIDEBAR_W — must match `const SIDEBAR_W = 130` in Sidebar.tsx
//   HEADER_H  — must match the `height: 100` header in AppHeader.tsx
export const SIDEBAR_W = 130
export const HEADER_H = 100
