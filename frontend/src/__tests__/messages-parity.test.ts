import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import gu from "@/messages/gu.json";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function flatten(obj: Json, prefix = "", out: Record<string, string> = {}) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = String(obj);
  }
  return out;
}

// Collect ICU argument names: `{name}` and `{name, plural|select|...}`, including
// arguments nested inside plural/select branches. `#` is not an argument.
function icuArgs(msg: string): string[] {
  const names = new Set<string>();
  const re = /\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?=[,}])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(msg))) names.add(m[1]);
  // Drop plural/select keyword branches like `one {` / `other {`: those are
  // followed by `{` directly, so the regex above never captures them as args.
  return [...names].sort();
}

const catalogs = {
  en: flatten(en as Json),
  hi: flatten(hi as Json),
  gu: flatten(gu as Json),
};
const locales = Object.keys(catalogs) as (keyof typeof catalogs)[];

describe("message catalog parity", () => {
  it("has identical key sets across en/hi/gu", () => {
    const all = new Set<string>();
    for (const l of locales) Object.keys(catalogs[l]).forEach((k) => all.add(k));
    const problems: string[] = [];
    for (const k of [...all].sort()) {
      const missing = locales.filter((l) => !(k in catalogs[l]));
      if (missing.length) problems.push(`${k}: missing in ${missing.join(", ")}`);
    }
    expect(problems).toEqual([]);
  });

  it("uses the same ICU argument names in every locale", () => {
    const problems: string[] = [];
    for (const k of Object.keys(catalogs.en).sort()) {
      const base = icuArgs(catalogs.en[k]).join(",");
      for (const l of locales) {
        if (l === "en" || !(k in catalogs[l])) continue;
        const got = icuArgs(catalogs[l][k]).join(",");
        if (got !== base) problems.push(`${k} [${l}]: expected {${base}} got {${got}}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
