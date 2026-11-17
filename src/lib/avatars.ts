// Sample profile photographs for demo users (local, 128×128 JPEGs, ~4 KB each, shared with other EVOQ apps).
// Real user data / photos are never replaced: these only decorate the fictional sample team.
const POOL = ["m-01", "w-00", "m-04", "w-01", "m-05", "w-02", "m-07", "w-03", "m-08", "w-04", "m-09", "w-06", "m-10", "w-08", "m-11", "w-11"];

const KNOWN: Record<string, string> = {
  "Meera Iyer": "w-00",
  "Rohan Kulkarni": "m-01",
  "Kavita Rao": "w-01",
  "Arjun Mehta": "m-04",
  "Rahul Deshmukh": "m-05",
  "Sneha Patil": "w-02",
  "Priya Nair": "w-03",
  "Demo User": "w-00",
};

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

/** "Meera Iyer (Finance Manager)" → "Meera Iyer" */
export const cleanName = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").trim();

/** Stable photo for a person: explicit mapping for the sample team, deterministic hash for everyone else. */
export function avatarFor(name: string): string | undefined {
  const n = cleanName(name); if (!n || n === "—") return undefined;
  const key = KNOWN[n] ?? POOL[hash(n) % POOL.length];
  return `/avatars/${key}.jpg`;
}
