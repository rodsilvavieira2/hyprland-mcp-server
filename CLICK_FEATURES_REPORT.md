# Click Features Report (Updated)

**Date:** 2026-03-09  
**Repo:** `hyprland-mcp-server`  
**Context:** Consolidated findings from this chat, with fixes for click precision and workflow.

---

## Summary

The click tooling works, but precision issues occurred mostly due to coordinate-reference mistakes and focus drift between adjacent windows. The process is now fixed by standardizing coordinate handling and validation.

---

## Issues Identified

1. **Coordinate-space mismatch**
   - `hyprland_click_at(x, y)` uses **global monitor coordinates**.
   - Some clicks were estimated from window-only screenshots without proper conversion.

2. **`click_at` is not window-bound**
   - It clicks whatever surface is at that global pixel.
   - Adjacent windows (e.g., terminal) can receive the click if coordinates are slightly off.

3. **Focus drift near window boundaries**
   - Even after focus, edge clicks can shift active window unexpectedly.

4. **Small UI hit targets (gear icon)**
   - Small icons require high precision; minor offset errors cause misses.

5. **No strict post-click verification loop in earlier attempts**
   - Needed deterministic loop: click → screenshot → verify state change.

6. **Report factual inconsistency corrected**
   - Prior statement that `(x=572)` was outside opencode window range `(551–1906)` was incorrect.
   - `572` is **inside** that x-range.

---

## Implemented Fixes

### Fix 1: Standardize coordinate reference

- For `hyprland_click_at`, coordinates must come from a **full monitor screenshot** (global space).
- If using a window screenshot, convert local→global:

```text
global_x = window_x + local_x
global_y = window_y + local_y
```

### Fix 2: Prefer window-targeted click for app interactions

- Use `hyprland_click_window` with `address` + `focus_first=true` for in-window interactions.
- Use offsets from center to reduce dependency on absolute monitor positions.

### Fix 3: Add pre-click guardrail checklist

Before every click:

1. `hyprland_list_windows` → confirm target window geometry.
2. `hyprland_focus_window(address=...)`.
3. Validate intended click point is inside target bounds.

### Fix 4: Enforce post-click validation loop

After every click:

1. Capture screenshot (`hyprland_screenshot_active_window` or monitor).
2. Verify expected UI state changed.
3. If unchanged, retry with small bounded nudge (e.g., ±8 to ±16 px), then verify again.

### Fix 5: Add deterministic fallback strategy

- If icon hitbox is uncertain, perform a tiny search pattern around the estimated point:
  - center, left, right, up, down (small delta)
  - screenshot-check after each attempt
  - stop once expected state appears

---

## Recommended Operational Pattern

### Pattern A (Preferred): Window-relative click

1. `hyprland_focus_window(address=...)`
2. `hyprland_click_window(address=..., offset_x=..., offset_y=..., focus_first=true)`
3. `hyprland_screenshot_active_window()`
4. Verify UI change

### Pattern B: Absolute click (only when needed)

1. Capture **full monitor screenshot**
2. Select global `(x, y)`
3. `hyprland_click_at(x=..., y=...)`
4. Screenshot + verify

---

## Known Limitations (Current Tooling)

- No built-in element inspector or widget-bound click target discovery.
- No direct “click confirmation” API (must infer via state change in screenshot).
- Small icons remain sensitive to pixel-level errors without semantic selectors.

---

## Practical Outcome

The click issues were not primarily tool failure; they were mostly workflow/precision issues. With the fixes above (global-coordinate discipline, window-targeted clicking, and strict verification loop), reliability is materially improved.
