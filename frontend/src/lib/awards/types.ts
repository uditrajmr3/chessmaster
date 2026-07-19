export type Provenance = "verified" | "community" | "inferred";
export type RuleOp = ">=" | ">" | "<=" | "<" | "==" | "set_size" | "has_key";

export interface AwardRule {
  measurement: string;
  op: RuleOp;
  target: number;
}

export interface AwardEntry {
  id: string;
  slug: string;
  name: string;
  category: "achievements" | "books" | "passports";
  description: string;
  howTo: string;
  provenance: Provenance;
  hidden: boolean;
  rule?: AwardRule;
}

export interface Measurements { [k: string]: unknown }

export interface ScanResult {
  username: string;
  platform: "chesscom";
  scanned_at: string;
  games_parsed: number;
  games_skipped: number;
  truncated: boolean;
  measurements: Measurements;
}

export interface AwardStatus {
  id: string;
  earned: boolean;
  manual: boolean;
  progress: { current: number; target: number } | null;
}
