// Fixture: variable name "build" contains "ld" as a substring.
// The scanner must NOT detect this as an LD SDK call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const build: any = {};
const variant = build.variation("release-candidate", {}, false);
