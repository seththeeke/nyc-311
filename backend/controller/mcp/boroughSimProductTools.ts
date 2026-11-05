import { z } from "zod";
import type { BoroughSimProductClient } from "../../service/productClient/boroughSimProductClient";
import { defineTool, type McpTool } from "./mcpTool";

export type BoroughSimProductTool = McpTool<BoroughSimProductClient>;

const tool = defineTool<BoroughSimProductClient>();
const description = z.string().trim().min(1).max(500).describe("Written for the resident, who sees it on their request. Name the ticket number, never a link.");

/* The CPO's tools (docs/17-executive-team.md §17.2): contacts and the WBR. No capacity tools. */
export const BOROUGH_SIM_PRODUCT_TOOLS: readonly BoroughSimProductTool[] = [
  tool({
    name: "list_contacts",
    description: "List residents' feature requests, newest first by default, optionally by status (RECEIVED, IN_PROGRESS, CLOSED). Pass next_cursor back as cursor for the next page.",
    inputSchema: {
      status: z.enum(["RECEIVED", "IN_PROGRESS", "CLOSED"]).optional(),
      order: z.enum(["NEWEST", "OLDEST"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.string().min(1).optional(),
    },
    run: (client, args) => client.listContacts(args),
  }),
  tool({
    name: "track_contact",
    description: "Mark a contact IN_PROGRESS: it's tracked by a backlog ticket, new or existing.",
    inputSchema: { contact_id: z.string().min(1), ticket_number: z.number().int().positive(), status_reason_description: description },
    run: (client, args) => client.updateContact({ ...args, status: "IN_PROGRESS" }),
  }),
  tool({
    name: "close_contact",
    description: "Close a contact: DUPLICATE of another request, DECLINED with the reason, or SHIPPED. Closing is final.",
    inputSchema: {
      contact_id: z.string().min(1),
      closure_reason_code: z.enum(["DUPLICATE", "DECLINED", "SHIPPED"]),
      status_reason_description: description,
      ticket_number: z.number().int().positive().optional().describe("The ticket it duplicates or that shipped it, if any."),
    },
    run: (client, args) => client.updateContact({ ...args, status: "CLOSED" }),
  }),
  tool({
    name: "get_wbr",
    description: "Read the latest weekly business reviews (the wbr warehouse job's results), newest first: cost, orders, time to resolve, rejections and failures per week.",
    inputSchema: { weeks: z.number().int().min(1).max(12).default(4) },
    run: (client, args) => client.getWbr(args.weeks),
  }),
];
