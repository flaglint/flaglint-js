// Fixture: generic arrow function in a .ts file.
// The parser must handle <T> as a TypeScript generic, not a JSX tag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const flagPredicate = <T>(flagKey: string, defaultValue: T): T => defaultValue;
