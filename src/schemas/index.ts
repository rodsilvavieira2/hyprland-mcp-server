/**
 * Shared Zod schemas for tool input validation.
 */

import { z } from "zod";

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export const ResponseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for structured data");

export const WindowSelectorSchema = z.object({
  address: z
    .string()
    .optional()
    .describe(
      "Exact window address (e.g. '0x55e21b244e60'). Use hyprland_list_windows to find addresses."
    ),
  class: z
    .string()
    .optional()
    .describe(
      "Window class substring to match (case-insensitive, e.g. 'firefox', 'Alacritty')"
    ),
  title: z
    .string()
    .optional()
    .describe(
      "Window title substring to match (case-insensitive, e.g. 'vim', 'Settings')"
    ),
  pid: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Exact process ID of the window"),
});

export type WindowSelector = z.infer<typeof WindowSelectorSchema>;
