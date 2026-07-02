// Global test setup: mock next-intl so components that use `useTranslations`
// render without a NextIntlClientProvider. The mock resolves keys against the
// real English catalog, so assertions on visible English text keep working.

import React from "react";

jest.mock("next-intl", () => {
  // Resolved through moduleNameMapper (@/ -> src/).
  const messages: Record<string, unknown> = require("@/messages/en.json");

  const lookup = (ns: string | undefined, key: string): string | undefined => {
    const root = (ns ? (messages as Record<string, unknown>)[ns] : messages) as
      | Record<string, unknown>
      | undefined;
    const val = key
      .split(".")
      .reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), root);
    return typeof val === "string" ? val : undefined;
  };

  const makeT = (ns?: string) => {
    const t = (key: string, values?: Record<string, string | number>) => {
      let s = lookup(ns, key);
      if (s == null) return key;
      if (values) {
        for (const k of Object.keys(values)) s = s.split(`{${k}}`).join(String(values[k]));
      }
      return s;
    };
    t.has = (key: string) => lookup(ns, key) != null;
    t.rich = (key: string, tags: Record<string, unknown> = {}) => {
      let s = lookup(ns, key) ?? key;
      // Plain value substitutions ({name}).
      for (const k of Object.keys(tags)) {
        if (typeof tags[k] !== "function") s = s.split(`{${k}}`).join(String(tags[k]));
      }
      const fnTags = Object.keys(tags).filter((k) => typeof tags[k] === "function");
      if (fnTags.length === 0) return s;
      const re = new RegExp(`<(${fnTags.join("|")})>([\\s\\S]*?)</\\1>`);
      const out: React.ReactNode[] = [];
      let rest = s;
      let i = 0;
      let m: RegExpMatchArray | null;
      while ((m = rest.match(re))) {
        const idx = rest.indexOf(m[0]);
        if (idx > 0) out.push(rest.slice(0, idx));
        const fn = tags[m[1]] as (chunks: React.ReactNode) => React.ReactNode;
        out.push(<React.Fragment key={i++}>{fn(m[2])}</React.Fragment>);
        rest = rest.slice(idx + m[0].length);
      }
      if (rest) out.push(rest);
      return out;
    };
    return t;
  };

  return {
    __esModule: true,
    useTranslations: (ns?: string) => makeT(ns),
    useLocale: () => "en",
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});
