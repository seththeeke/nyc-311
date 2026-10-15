import { describe, expect, it } from "vitest";
import { CustomerIdeaPageSchema, CustomerIdeaSchema } from "../../src/models/customerIdea";
import { MOCK_CUSTOMER_IDEAS } from "../../src/test-data/customerIdeas";

const [first] = MOCK_CUSTOMER_IDEAS;

describe("CustomerIdeaSchema", () => {
  it("accepts every sample idea, anchored or not", () => {
    for (const idea of MOCK_CUSTOMER_IDEAS) expect(CustomerIdeaSchema.parse(idea)).toEqual(idea);
    expect(MOCK_CUSTOMER_IDEAS.some((idea) => idea.anchor === null)).toBe(true);
  });

  it("rejects an unknown idea type, a status other than OPEN and negative token counts", () => {
    expect(CustomerIdeaSchema.safeParse({ ...first, idea_type: "COMPLIMENT" }).success).toBe(false);
    expect(CustomerIdeaSchema.safeParse({ ...first, status: "ACTIONED" }).success).toBe(false);
    expect(CustomerIdeaSchema.safeParse({ ...first, input_tokens: -1 }).success).toBe(false);
  });
});

describe("CustomerIdeaPageSchema", () => {
  it("reads a page of ideas", () => {
    expect(CustomerIdeaPageSchema.parse({ items: [first], nextCursor: null }).items).toHaveLength(1);
  });
});
