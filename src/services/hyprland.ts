/**
 * Hyprland IPC service — wraps hyprctl and grim to query window state
 * and capture screenshots. All operations are read-only (no compositor mutations).
 */

import { execSync, execFileSync } from "child_process";
import { mkdtempSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type {
  HyprlandWindow,
  HyprlandMonitor,
  HyprlandWorkspace,
  WindowInfo,
  MonitorInfo,
  WorkspaceInfo,
  ScreenshotResult,
} from "../types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function runHyprctl(subcommand: string, extra: string[] = []): string {
  try {
    return execFileSync("hyprctl", [subcommand, "-j", ...extra], {
      encoding: "utf8",
      env: { ...process.env },
    }).trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`hyprctl ${subcommand} failed: ${msg}`);
  }
}

function runGrim(geometry: string, outputPath: string): void {
  try {
    // grim -g "x,y WxH" <output_file>
    execFileSync("grim", ["-g", geometry, outputPath], {
      encoding: "utf8",
      env: { ...process.env, WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY ?? "wayland-1" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`grim capture failed: ${msg}. Ensure WAYLAND_DISPLAY is set and grim is installed.`);
  }
}

function geometryString(x: number, y: number, w: number, h: number): string {
  return `${x},${y} ${w}x${h}`;
}

function mapWindow(w: HyprlandWindow): WindowInfo {
  return {
    address: w.address,
    class: w.class,
    title: w.title,
    pid: w.pid,
    workspace_id: w.workspace.id,
    workspace_name: w.workspace.name,
    monitor_id: w.monitor,
    x: w.at[0],
    y: w.at[1],
    width: w.size[0],
    height: w.size[1],
    floating: w.floating,
    pinned: w.pinned,
    fullscreen: w.fullscreen > 0,
    xwayland: w.xwayland,
    hidden: w.hidden,
  };
}

function mapMonitor(m: HyprlandMonitor): MonitorInfo {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    make: m.make,
    model: m.model,
    width: m.width,
    height: m.height,
    refresh_rate: m.refreshRate,
    x: m.x,
    y: m.y,
    scale: m.scale,
    focused: m.focused,
    active_workspace_id: m.activeWorkspace.id,
    active_workspace_name: m.activeWorkspace.name,
  };
}

function mapWorkspace(ws: HyprlandWorkspace): WorkspaceInfo {
  return {
    id: ws.id,
    name: ws.name,
    monitor: ws.monitor,
    window_count: ws.windows,
    has_fullscreen: ws.hasfullscreen,
    last_window_address: ws.lastwindow,
    last_window_title: ws.lastwindowtitle,
  };
}

// ---------------------------------------------------------------------------
// Screenshot helper — captures a geometry region and returns base64 + path
// ---------------------------------------------------------------------------

function captureGeometry(
  geometry: string,
  window: HyprlandWindow
): ScreenshotResult {
  const tmpDir = mkdtempSync(join(tmpdir(), "hyprland-mcp-"));
  const filePath = join(tmpDir, `${window.address}.png`);

  runGrim(geometry, filePath);

  if (!existsSync(filePath)) {
    throw new Error(`Screenshot file was not created at ${filePath}`);
  }

  const imageBuffer = readFileSync(filePath);
  const base64Image = imageBuffer.toString("base64");

  return {
    window_address: window.address,
    window_class: window.class,
    window_title: window.title,
    geometry,
    file_path: filePath,
    base64_image: base64Image,
    width: window.size[0],
    height: window.size[1],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns all open (mapped, non-hidden) windows. */
export function listWindows(includeHidden = false): WindowInfo[] {
  const raw = JSON.parse(runHyprctl("clients")) as HyprlandWindow[];
  return raw
    .filter((w) => w.mapped && (includeHidden || !w.hidden))
    .map(mapWindow);
}

/** Returns all raw HyprlandWindow objects (needed for screenshot geometry). */
export function listRawWindows(): HyprlandWindow[] {
  const raw = JSON.parse(runHyprctl("clients")) as HyprlandWindow[];
  return raw.filter((w) => w.mapped);
}

/** Returns the currently focused window info, or null if none. */
export function getActiveWindow(): WindowInfo | null {
  try {
    const raw = JSON.parse(runHyprctl("activewindow")) as HyprlandWindow;
    if (!raw || !raw.address) return null;
    return mapWindow(raw);
  } catch {
    return null;
  }
}

/** Returns the raw active window (needed for screenshot). */
export function getRawActiveWindow(): HyprlandWindow | null {
  try {
    const raw = JSON.parse(runHyprctl("activewindow")) as HyprlandWindow;
    if (!raw || !raw.address) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Returns all monitors. */
export function listMonitors(): MonitorInfo[] {
  const raw = JSON.parse(runHyprctl("monitors")) as HyprlandMonitor[];
  return raw.map(mapMonitor);
}

/** Returns all raw monitors (needed for screenshot). */
export function listRawMonitors(): HyprlandMonitor[] {
  return JSON.parse(runHyprctl("monitors")) as HyprlandMonitor[];
}

/** Returns all workspaces. */
export function listWorkspaces(): WorkspaceInfo[] {
  const raw = JSON.parse(runHyprctl("workspaces")) as HyprlandWorkspace[];
  return raw.map(mapWorkspace);
}

/**
 * Finds a window by address, class (substring, case-insensitive), or title
 * (substring, case-insensitive). Throws if not found.
 */
export function findWindow(opts: {
  address?: string;
  class?: string;
  title?: string;
  pid?: number;
}): HyprlandWindow {
  const windows = listRawWindows();

  const match = windows.find((w) => {
    if (opts.address) return w.address === opts.address;
    if (opts.pid) return w.pid === opts.pid;
    const classMatch = opts.class
      ? w.class.toLowerCase().includes(opts.class.toLowerCase())
      : true;
    const titleMatch = opts.title
      ? w.title.toLowerCase().includes(opts.title.toLowerCase())
      : true;
    return classMatch && titleMatch;
  });

  if (!match) {
    const tried = JSON.stringify(opts);
    throw new Error(
      `No window found matching ${tried}. ` +
        `Use hyprland_list_windows to see available windows and their addresses/classes.`
    );
  }

  return match;
}

/**
 * Captures a screenshot of a specific window using its geometry.
 * The window must be mapped and visible on screen.
 */
export function screenshotWindow(window: HyprlandWindow): ScreenshotResult {
  const [x, y] = window.at;
  const [w, h] = window.size;

  if (w <= 0 || h <= 0) {
    throw new Error(
      `Window "${window.class}" has invalid size ${w}x${h}. It may be minimized or hidden.`
    );
  }

  const geometry = geometryString(x, y, w, h);
  return captureGeometry(geometry, window);
}

/**
 * Captures a screenshot of an entire monitor by its name (e.g. "DP-1").
 */
export function screenshotMonitor(monitor: HyprlandMonitor): ScreenshotResult {
  const geometry = geometryString(monitor.x, monitor.y, monitor.width, monitor.height);

  // Use a synthetic HyprlandWindow stub to reuse captureGeometry
  const stub: HyprlandWindow = {
    address: `monitor-${monitor.id}`,
    mapped: true,
    hidden: false,
    at: [monitor.x, monitor.y],
    size: [monitor.width, monitor.height],
    workspace: monitor.activeWorkspace,
    floating: false,
    monitor: monitor.id,
    class: "monitor",
    title: monitor.name,
    initialClass: "monitor",
    initialTitle: monitor.name,
    pid: 0,
    xwayland: false,
    pinned: false,
    fullscreen: 0,
    fullscreenClient: 0,
    grouped: [],
    tags: [],
    focusHistoryID: -1,
    inhibitingIdle: false,
  };

  return captureGeometry(geometry, stub);
}

/** Checks whether required external binaries are available on PATH. */
export function checkDependencies(): { ok: boolean; missing: string[] } {
  const required = ["hyprctl", "grim"];
  const missing: string[] = [];

  for (const bin of required) {
    try {
      execSync(`which ${bin}`, { stdio: "ignore" });
    } catch {
      missing.push(bin);
    }
  }

  return { ok: missing.length === 0, missing };
}
