// Hit zones of hlstats_Players_Weapons, as shown on the hitbox. neck comes
// with collector migration 7 and only Counter-Strike 2 logs it; the hitbox
// shows it only when it has hits.
export const ZONES = ["head", "neck", "chest", "stomach", "leftarm", "rightarm", "leftleg", "rightleg"] as const;
export type Zone = (typeof ZONES)[number];
