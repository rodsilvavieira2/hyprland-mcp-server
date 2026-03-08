/**
 * hyprland_list_windows — list all open windows with metadata.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listWindows } from "../services/hyprland.js";
import { ResponseFormat, ResponseFormatSchema } from "../schemas/index.js";
import type { WindowInfo } from "../types.js";

const InputSchema = z
  .object({
    include_hidden: z
      .boolean()
      .default(false)
      .describe("Include hidden/scratchpad windows in the results"),
    workspace_id: z
      .number()
      .int()
      .optional()
      .describe("Filter windows by workspace ID. Omit to return all workspaces."),
    class_filter: z
      .string()
      .optional()
      .describe("Filter by window class substring (case-insensitive)"),
    response_format: ResponseFormatSchema,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

function formatMarkdown(windows: WindowInfo[]): string {
  if (windows.length === 0) return "No open windows found.";
  const lines: string[] = [
    `# Open Windows (${windows.length})`,
    "",
  ];
  for (const w of windows) {
    lines.push(`## ${w.class || "(no class)"} — ${w.title || "(no title)"}`);
    lines.push(`- **Address**: \`${w.address}\``);
    lines.push(`- **PID**: ${w.pid}`);
    lines.push(`- **Workspace**: ${w.workspace_name} (id ${w.workspace_id})`);
    lines.push(`- **Monitor**: ${w.monitor_id}`);
    lines.push(`- **Position**: ${w.x},${w.y}  **Size**: ${w.width}×${w.height}`);
    lines.push(`- **Floating**: ${w.floating}  **Pinned**: ${w.pinned}  **Fullscreen**: ${w.fullscreen}  **XWayland**: ${w.xwayland}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function registerListWindows(server: McpServer): void {
  server.registerTool(
    "hyprland_list_windows",
    {
      title: "List Hyprland Windows",
      description: `List all open windows in the Hyprland Wayland compositor with their metadata.

Returns window address, class, title, PID, workspace, monitor, geometry (position + size),
and flags (floating, pinned, fullscreen, XWayland).

The window \`address\` is the unique identifier required by other tools such as
\`hyprland_screenshot_window\`.

Args:
  - include_hidden (boolean): Include hidden/scratchpad windows (default: false)
  - workspace_id (number): Filter by workspace ID (optional)
  - class_filter (string): Filter by window class substring (optional)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON: Array of window objects with fields:
    address, class, title, pid, workspace_id, workspace_name, monitor_id,
    x, y, width, height, floating, pinned, fullscreen, xwayland, hidden

Examples:
  - Use when: "What windows are open?" → no filters
  - Use when: "Show firefox windows" → class_filter="firefox"
  - Use when: "Windows on workspace 2" → workspace_id=2`,
      inputSchema: InputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: Input) => {
      try {
        let windows = listWindows(params.include_hidden);

        if (params.workspace_id !== undefined) {
          windows = windows.filter((w) => w.workspace_id === params.workspace_id);
        }
        if (params.class_filter) {
          const filter = params.class_filter.toLowerCase();
          windows = windows.filter((w) => w.class.toLowerCase().includes(filter));
        }

        const structured = { count: windows.length, windows };

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(structured, null, 2)
            : formatMarkdown(windows);

        return {
          content: [{ type: "text", text }],
          structuredContent: structured,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${msg}` }],
        };
      }
    }
  );
}
