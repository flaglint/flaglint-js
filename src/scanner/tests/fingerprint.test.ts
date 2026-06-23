import { describe, it, expect } from "vitest";
import { generateFingerprint } from "../fingerprint.js";

describe("generateFingerprint", () => {
  it("produces provider:callType:flagKey:normalizedPath", () => {
    expect(generateFingerprint("checkout-v2", "boolVariation", "src/service.ts"))
      .toBe("launchdarkly:boolVariation:checkout-v2:src/service.ts");
  });

  it("normalizes backslashes on Windows paths", () => {
    expect(generateFingerprint("my-flag", "stringVariation", "src\\checkout\\service.ts"))
      .toBe("launchdarkly:stringVariation:my-flag:src/checkout/service.ts");
  });

  it("removes leading ./", () => {
    expect(generateFingerprint("flag-a", "variation", "./src/file.ts"))
      .toBe("launchdarkly:variation:flag-a:src/file.ts");
  });

  it("appends dynamic index for wildcard keys", () => {
    expect(generateFingerprint("*", "boolVariation", "src/service.ts", 0))
      .toBe("launchdarkly:boolVariation:*:src/service.ts:0");
    expect(generateFingerprint("*", "boolVariation", "src/service.ts", 1))
      .toBe("launchdarkly:boolVariation:*:src/service.ts:1");
  });

  it("is stable — same inputs always produce same output", () => {
    const fp1 = generateFingerprint("checkout-v2", "boolVariation", "src/service.ts");
    const fp2 = generateFingerprint("checkout-v2", "boolVariation", "src/service.ts");
    expect(fp1).toBe(fp2);
  });

  it("differs by callType", () => {
    const fp1 = generateFingerprint("flag", "boolVariation", "src/file.ts");
    const fp2 = generateFingerprint("flag", "stringVariation", "src/file.ts");
    expect(fp1).not.toBe(fp2);
  });

  it("differs by file path", () => {
    const fp1 = generateFingerprint("flag", "boolVariation", "src/a.ts");
    const fp2 = generateFingerprint("flag", "boolVariation", "src/b.ts");
    expect(fp1).not.toBe(fp2);
  });
});
