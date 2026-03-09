/**
 * TypeScript interfaces mirroring Hyprland IPC JSON structures.
 * Based on hyprctl -j output from Hyprland 0.54+
 */

export interface HyprlandWorkspaceRef {
  id: number;
  name: string;
}

export interface HyprlandWindow {
  address: string;
  mapped: boolean;
  hidden: boolean;
  at: [number, number];
  size: [number, number];
  workspace: HyprlandWorkspaceRef;
  floating: boolean;
  monitor: number;
  class: string;
  title: string;
  initialClass: string;
  initialTitle: string;
  pid: number;
  xwayland: boolean;
  pinned: boolean;
  fullscreen: number;
  fullscreenClient: number;
  grouped: string[];
  tags: string[];
  focusHistoryID: number;
  inhibitingIdle: boolean;
}

export interface HyprlandMonitor {
  id: number;
  name: string;
  description: string;
  make: string;
  model: string;
  serial: string;
  width: number;
  height: number;
  physicalWidth: number;
  physicalHeight: number;
  refreshRate: number;
  x: number;
  y: number;
  activeWorkspace: HyprlandWorkspaceRef;
  reserved: [number, number, number, number];
  scale: number;
  transform: number;
  focused: boolean;
  dpmsStatus: boolean;
  vrr: boolean;
}

export interface HyprlandWorkspace {
  id: number;
  name: string;
  monitor: string;
  monitorID: number;
  windows: number;
  hasfullscreen: boolean;
  lastwindow: string;
  lastwindowtitle: string;
}

export interface ScreenshotResult {
  window_address: string;
  window_class: string;
  window_title: string;
  geometry: string;
  file_path: string;
  base64_image: string;
  width: number;
  height: number;
}

export interface WindowInfo {
  address: string;
  class: string;
  title: string;
  pid: number;
  workspace_id: number;
  workspace_name: string;
  monitor_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  floating: boolean;
  pinned: boolean;
  fullscreen: boolean;
  xwayland: boolean;
  hidden: boolean;
}

export interface MonitorInfo {
  id: number;
  name: string;
  description: string;
  make: string;
  model: string;
  width: number;
  height: number;
  refresh_rate: number;
  x: number;
  y: number;
  scale: number;
  focused: boolean;
  active_workspace_id: number;
  active_workspace_name: string;
}

export interface WorkspaceInfo {
  id: number;
  name: string;
  monitor: string;
  window_count: number;
  has_fullscreen: boolean;
  last_window_address: string;
  last_window_title: string;
}

export interface CursorPos {
  x: number;
  y: number;
}

export interface ClickResult {
  x: number;
  y: number;
  button: string;
}

export interface InputResult {
  success: boolean;
  action: string;
  detail?: string;
  active_window?: { address: string; class: string; title: string };
}
