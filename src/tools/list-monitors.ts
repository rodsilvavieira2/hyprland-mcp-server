/**
 * hyprland_list_monitors -- list all connected monitors.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listMonitors } from "../services/hyprland.js";
import { ResponseFormat, ResponseFormatSchema } from "../schemas/index.js";
import type { MonitorInfo } from "../types.js";

const InputSchema = z
  .object({
    response_format: ResponseFormatSchema,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

function formatMarkdown(monitors: MonitorInfo[]): string {
  if (monitors.length === 0) return "No monitors found.";
  const lines: string[] = ["# Monitors (" + monitors.length + ")", ""];
  for (const m of monitors) {
    const focused = m.focused ? " (focused)" : "";
    lines.push("## " + m.name + focused);
    lines.push("- **ID**: " + m.id);
    lines.push("- **Description**: " + m.description);
    lines.push("- **Make / Model**: " + m.make + " " + m.model);
    lines.push("- **Resolution**: " + m.width + "x" + m.height + " @ " + m.refresh_rate.toFixed(2) + " Hz");
    lines.push("- **Position**: " + m.x + "," + m.y + "  **Scale**: " + m.scale);
    lines.push("- **Active Workspace**: " + m.active_workspace_name + " (id " + m.active_workspace_id + ")");
    lines.push("");
  }
  return lines.join("\n");
}

export function registerListMonitors(server: McpServer): void {
  server.registerTool(
    "hyprland_list_monitors",
    {
      title: "List Hyprland Monitors",
      description:
        "List all connected monitors in Hyprland with resolution, position, refresh rate, and scale.\n\n" +
        "Use monitor names (e.g. 'DP-1', 'HDMI-A-1') with hyprland_screenshot_monitor.\n\n" +
        "Args:\n" +
        "  - response_format ('markdown' | 'json'): Output format (default: 'markdown')\n\n" +
        "Returns:\n" +
        "  Array of monitor objects: id, name, description, make, model, width, height,\n" +
        "  refresh_rate, x, y, scale, focused, active_workspace_id, active_workspace_name\n\n" +
        "Examples:\n" +
        "  - Use when: 'What monitors do I have?'\n" +
        "  - Use when: 'What resolution is my screen?'",
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
        const monitors = listMonitors();
        const structured = { count: monitors.length, monitors };

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(structured, null, 2)
            : formatMarkdown(monitors);

        return {
          content: [{ type: "text", text }],
          structuredContent: structured,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: "Error: " + msg }],
        };
      }
    }
  );
}
