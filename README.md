# hyprland-mcp-server

MCP server (Model Context Protocol) for capturing screenshots and querying window/monitor/workspace state in the [Hyprland](https://hyprland.org/) Wayland compositor.

Enables LLMs to see your screen, inspect open windows, and navigate your desktop layout.

## Requirements

| Binary | Source |
|--------|--------|
| `hyprctl` | Bundled with Hyprland |
| `grim` | https://sr.ht/~emersion/grim/ (`pacman -S grim` / `apt install grim`) |

The server must run inside an active Hyprland session with `WAYLAND_DISPLAY` set.

## Installation

```bash
cd hyprland-mcp-server
npm install
npm run build
```

## MCP Client Configuration

### Claude Desktop / opencode

```json
{
  "mcpServers": {
    "hyprland": {
      "command": "node",
      "args": ["/absolute/path/to/hyprland-mcp-server/dist/index.js"]
    }
  }
}
```

### Run manually (for testing)

```bash
node dist/index.js
# or during development:
npm run dev
```

## Tools

| Tool | Description |
|------|-------------|
| `hyprland_list_windows` | List all open windows with class, title, address, geometry, workspace |
| `hyprland_get_active_window` | Get metadata for the currently focused window |
| `hyprland_screenshot_window` | Capture a PNG of a specific window (by address, class, title, or PID) |
| `hyprland_screenshot_active_window` | Capture a PNG of the currently focused window |
| `hyprland_screenshot_monitor` | Capture a full monitor screenshot |
| `hyprland_list_monitors` | List monitors with resolution, refresh rate, position, scale |
| `hyprland_list_workspaces` | List workspaces with window counts and monitor assignments |
| `hyprland_click_at` | Simulates a mouse click at absolute global coordinates in Hyprland. Useful for programmatically interacting with specific screen positions. |
| `hyprland_click_window` | Targets the center of a specific window in Hyprland for a mouse click, with optional offsets. |
| `hyprland_move_cursor` | Moves the mouse cursor to specified global coordinates without clicking. |
| `hyprland_get_cursor_pos` | Retrieves the current cursor position in the global layout coordinates. |
| `hyprland_type_text` | Types a text string into the currently focused window using Wayland-native input injection. |
| `hyprland_press_key` | Sends a single keypress event (e.g., Enter, Tab, Escape) to the currently focused window. |
| `hyprland_send_key` | Sends a key or a key combination (e.g., "Ctrl+C") to a specific window or the active window. |
| `hyprland_focus_window` | Brings keyboard and compositor focus to a specific window, enabling further interactions. |

## Example Usage

```
"Screenshot the terminal window"
  -> hyprland_screenshot_window(class="Alacritty")

"What apps are open on workspace 2?"
  -> hyprland_list_windows(workspace_id=2)

"Take a screenshot of my screen"
  -> hyprland_screenshot_monitor()

"What am I looking at right now?"
  -> hyprland_get_active_window()
```

## Screenshot Response

Screenshot tools return:
- A **text block** with geometry, file path, and window info
- An **image block** (base64 PNG) so the LLM can visually inspect the content
- A **structuredContent** block with JSON metadata

Screenshots are saved to a temporary directory under `/tmp/hyprland-mcp-*`.

## Development

```bash
npm run dev      # tsx watch mode
npm run build    # compile TypeScript
npm run clean    # remove dist/
```

## Architecture

```
src/
  index.ts              # Server init, dependency check, tool registration
  types.ts              # TypeScript interfaces for Hyprland IPC structs
  schemas/index.ts      # Shared Zod schemas (ResponseFormat, WindowSelector)
  services/
    hyprland.ts         # hyprctl wrapper, grim capture, window/monitor queries
  tools/
    list-windows.ts
    get-active-window.ts
    screenshot-window.ts
    screenshot-active-window.ts
    screenshot-monitor.ts
    list-monitors.ts
    list-workspaces.ts
```
