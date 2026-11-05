import { describe, expect, it } from "vitest";
import { parseCognitoGroups } from "../../models/cognitoGroup";

describe("parseCognitoGroups", () => {
  it("reads API Gateway's flattened [A B] form", () => {
    expect(parseCognitoGroups("[ADMIN BOROUGH_SIM_TEAM]")).toEqual(["ADMIN", "BOROUGH_SIM_TEAM"]);
  });

  it("reads a single group and comma-separated groups", () => {
    expect(parseCognitoGroups("BOROUGH_SIM_OPERATIONS")).toEqual(["BOROUGH_SIM_OPERATIONS"]);
    expect(parseCognitoGroups("[BOROUGH_SIM_TEAM BOROUGH_SIM_PRODUCT]")).toEqual(["BOROUGH_SIM_TEAM", "BOROUGH_SIM_PRODUCT"]);
    expect(parseCognitoGroups("ADMIN,BOROUGH_SIM_TEAM")).toEqual(["ADMIN", "BOROUGH_SIM_TEAM"]);
  });

  it("drops unknown names and returns nothing for a missing claim", () => {
    expect(parseCognitoGroups("[ADMIN SOMETHING_ELSE]")).toEqual(["ADMIN"]);
    expect(parseCognitoGroups(undefined)).toEqual([]);
    expect(parseCognitoGroups("")).toEqual([]);
  });
});
