/**
 * hyprland_list_workspaces -- list all workspaces with window counts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listWorkspaces } from "../services/hyprland.js";
import { ResponseFormat, ResponseFormatSchema } from "../schemas/index.js";
import type { WorkspaceInfo } from "../types.js";

const InputSchema = z
  .object({
    response_format: ResponseFormatSchema,
  })
  .strict();

type Input = z.infer<typeof InputSchema>;

function formatMarkdown(workspaces: WorkspaceInfo[]): string {
  if (workspaces.length === 0) return "No workspaces found.";
  const lines: string[] = ["# Workspaces (" + workspaces.length + ")", ""];
  for (const ws of workspaces) {
    lines.push("## Workspace " + ws.name + " (id " + ws.id + ")");
    lines.push("- **Monitor**: " + ws.monitor);
    lines.push("- **Windows**: " + ws.window_count);
    lines.push("- **Has fullscreen**: " + ws.has_fullscreen);
    if (ws.last_window_title) {
      lines.push("- **Last window**: " + ws.last_window_title);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function registerListWorkspaces(server: McpServer): void {
  server.registerTool(
    "hyprland_list_workspaces",
    {
      title: "List Hyprland Workspaces",
      description:
        "List all workspaces in Hyprland with window counts and monitor assignments.\n\n" +
        "Returns workspace ID, name, monitor name, window count, fullscreen state,\n" +
        "and the title of the last focused window in that workspace.\n\n" +
        "Args:\n" +
        "  - response_format ('markdown' | 'json'): Output format (default: 'markdown')\n\n" +
        "Returns:\n" +
        "  Array of workspace objects: id, name, monitor, window_count,\n" +
        "  has_fullscreen, last_window_address, last_window_title\n\n" +
        "Examples:\n" +
        "  - Use when: 'How many workspaces do I have?'\n" +
        "  - Use when: 'Which workspace has the most windows?'\n" +
        "  - Use when: 'What is on workspace 3?'",
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
        const workspaces = listWorkspaces();
        const structured = { count: workspaces.length, workspaces };

        const text =
          params.response_format === ResponseFormat.JSON
            ? JSON.stringify(structured, null, 2)
            : formatMarkdown(workspaces);

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
