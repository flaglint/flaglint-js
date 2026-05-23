// Fixture: variable names that contain "ld" as a substring but are NOT LD clients.
// The scanner must NOT detect any of these as LD SDK calls.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const ctx: any;
const child: any  = {};
const world: any  = {};
const bold: any   = {};
const fields: any = {};
export const r1 = child.variation("child-flag", ctx, false);
export const r2 = world.variation("world-flag", ctx, false);
export const r3 = bold.variation("bold-flag", ctx, false);
export const r4 = fields.variation("fields-flag", ctx, false);
