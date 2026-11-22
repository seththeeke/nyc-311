import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FeatureRequestDraftSchema } from "../../models/boroughSimPublicApi";
import { ACTION_TOOLS, type ActionTool, type ToolContext } from "../../service/action/actionTools";
import { FINISH_TOOL_SPEC, FinishInputSchema } from "../../service/action/ideaActionService";
import { NothingToSayInputSchema, RecordIdeaInputSchema, toolConfig } from "../../service/idea/bedrockIdeaGenerator";
import { idea } from "../residentFixtures";
import { toolSpecViolations } from "./toolSpecContract";

/* Every Bedrock tool spec against the zod schema that parses its reply (#240). */

function ideaToolSpec(name: string): Record<string, unknown> {
  const spec = toolConfig(["01ORDER"], ["01FR"]).tools?.find((tool) => tool.toolSpec?.name === name)?.toolSpec?.inputSchema?.json;
  return spec as Record<string, unknown>;
}

describe("Bedrock tool specs match their parsers", () => {
  it("finish_idea", () => {
    expect(toolSpecViolations("finish_idea", FinishInputSchema, FINISH_TOOL_SPEC.inputSchema)).toEqual([]);
  });

  it("record_idea", () => {
    expect(toolSpecViolations("record_idea", RecordIdeaInputSchema, ideaToolSpec("record_idea"))).toEqual([]);
  });

  it("nothing_to_say", () => {
    expect(toolSpecViolations("nothing_to_say", NothingToSayInputSchema, ideaToolSpec("nothing_to_say"))).toEqual([]);
  });

  it("CREATE_FEATURE_REQUEST", () => {
    const spec = (ACTION_TOOLS.CREATE_FEATURE_REQUEST as ActionTool).inputSchema({ idea } as ToolContext);
    expect(toolSpecViolations("CREATE_FEATURE_REQUEST", FeatureRequestDraftSchema, spec)).toEqual([]);
  });
});

describe("toolSpecViolations", () => {
  const parser = z.object({ kind: z.enum(["A", "B"]), note: z.string().trim().min(5).max(50).nullable().optional() });

  it("accepts a spec that states every limit and is no looser than the parser", () => {
    const spec = { properties: { kind: { enum: ["B", "A"] }, note: { description: "5 to 50 characters." } }, required: ["kind"] };
    expect(toolSpecViolations("t", parser, spec)).toEqual([]);
  });

  it("reports each kind of drift", () => {
    const spec = { properties: { kind: { enum: ["A"] }, note: { description: "Anything." }, extra: {} } };
    expect(toolSpecViolations("t", parser, spec)).toEqual([
      "t.extra: in the spec but not the parser",
      "t.kind: the parser requires it but the spec does not",
      "t.kind: enum differs (parser A|B, spec A)",
      "t.note: max 50 not in the spec",
      "t.note: min 5 not in the spec",
    ]);
    expect(toolSpecViolations("t", z.object({ gone: z.number() }), { properties: {} })).toEqual(["t.gone: in the parser but not the spec"]);
  });
});
