---
slug: disable-mobile-cell-tray
description: Decouple MobileCellTray from EditorShell — remove import and JSX usage, leave component logic intact
date: 2026-04-16
---

# Disable MobileCellTray

## Task
Remove `MobileCellTray` from `EditorShell.tsx` so it no longer renders. Leave `MobileCellTray.tsx` and its tests untouched.

## Steps
1. Remove `import { MobileCellTray } from './MobileCellTray';` from `EditorShell.tsx`
2. Remove `<MobileCellTray />` from the JSX in `EditorShell.tsx`
3. Commit the change
