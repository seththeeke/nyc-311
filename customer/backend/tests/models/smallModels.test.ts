import { describe, expect, it } from "vitest";
import { ApiGatewayHttpEventSchema } from "../../models/apiGatewayHttpEvent";
import { NotFoundError } from "../../models/errors";
import { IdeaWorkerEventSchema } from "../../models/ideaWorkerEvent";
import { ResidentSyncEventSchema } from "../../models/residentSyncEvent";
import { ResidentIdeaViewSchema, ResidentViewSchema } from "../../models/residentView";
import { toIdeaView, toResidentView } from "../../service/read/residentReadService";
import { current, idea } from "../residentFixtures";

describe("small resident-side models", () => {
  it("reads a schedule's input, with force optional", () => {
    expect(IdeaWorkerEventSchema.parse({ persona_id: "hawthorn" })).toEqual({ persona_id: "hawthorn" });
    expect(IdeaWorkerEventSchema.safeParse({ persona_id: "" }).success).toBe(false);
  });

  it("reads a custom-resource event", () => {
    expect(ResidentSyncEventSchema.safeParse({ RequestType: "Update", ResourceProperties: { SeedHash: "abc", ServiceToken: "x" } }).success).toBe(true);
    expect(ResidentSyncEventSchema.safeParse({ RequestType: "Poke", ResourceProperties: { SeedHash: "abc" } }).success).toBe(false);
  });

  it("describes what the read API returns", () => {
    expect(ResidentViewSchema.safeParse(toResidentView(current)).success).toBe(true);
    expect(ResidentIdeaViewSchema.safeParse(toIdeaView(idea, new Map())).success).toBe(true);
  });

  it("carries a routeKey and names a NotFoundError", () => {
    expect(ApiGatewayHttpEventSchema.parse({ rawPath: "/ideas", routeKey: "GET /ideas", requestContext: { http: { method: "GET" } } }).routeKey).toBe("GET /ideas");
    expect(new NotFoundError("gone").name).toBe("NotFoundError");
  });
});
