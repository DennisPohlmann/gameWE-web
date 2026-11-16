// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { warmBanLists } = await import("./lib/bans");
  // In the background; without a database the first visitor loads the list as before.
  warmBanLists().catch((err) => console.error("ban lists warm-up:", err instanceof Error ? err.message : err));
  // The running version for the collector's update notifications (gamewe_web_version).
  const version = process.env.APP_VERSION;
  if (version && /^[0-9A-Za-z.+-]{1,64}$/.test(version)) {
    const { adminExec, upsert } = await import("./lib/db");
    adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), ["gamewe_web_version", version]).catch((err) =>
      console.warn("storing gamewe_web_version:", err instanceof Error ? err.message : err),
    );
  }
  // Radar pictures of new maps, drawn when a server changes to one.
  (await import("./lib/overview-watch")).watchServerMaps();
}
