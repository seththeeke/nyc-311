import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalError } from "../../../models/errors";
import { SigningSecretStore } from "../../../service/webhook/signingSecretStore";

const ssmMock = mockClient(SSMClient);
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  ssmMock.reset();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SigningSecretStore", () => {
  it("reads a decrypted SecureString and never logs the value", async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: "whsec_topsecret" } });
    await expect(new SigningSecretStore().getSecret("/customer/prod/webhook/signing-secret")).resolves.toBe("whsec_topsecret");
    expect(ssmMock.commandCalls(GetParameterCommand)[0].args[0].input).toEqual({
      Name: "/customer/prod/webhook/signing-secret",
      WithDecryption: true,
    });
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("whsec_topsecret");
  });

  it("throws TerminalError for a parameter with no value", async () => {
    ssmMock.on(GetParameterCommand).resolves({});
    await expect(new SigningSecretStore(new SSMClient({})).getSecret("/missing")).rejects.toBeInstanceOf(TerminalError);
  });
});
