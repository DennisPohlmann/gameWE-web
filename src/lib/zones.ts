// Hit zones of hlstats_Players_Weapons, as shown on the hitbox.
export const ZONES = ["head", "chest", "stomach", "leftarm", "rightarm", "leftleg", "rightleg"] as const;
export type Zone = (typeof ZONES)[number];
