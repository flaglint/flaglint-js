import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const README = readFileSync(join(process.cwd(), "README.md"), "utf8");

describe("README provider setup credibility", () => {
  it("uses SDK key string constructor for LaunchDarklyProvider", () => {
    expect(README).toContain("new LaunchDarklyProvider(process.env.LD_SDK_KEY!)");
    expect(README).not.toContain("new LaunchDarklyProvider(ldClient)");
  });

  it("describes LaunchDarkly context key support accurately", () => {
    expect(README).toContain("targetingKey");
    expect(README).toContain("existing LaunchDarkly `key`");
    expect(README).not.toContain("must include targetingKey");
  });
});
