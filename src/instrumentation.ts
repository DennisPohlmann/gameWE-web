// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { warmBanLists } = await import("./lib/bans");
  // In the background; without a database the first visitor loads the list as before.
  warmBanLists().catch((err) => console.error("ban lists warm-up:", err instanceof Error ? err.message : err));
  // Radar pictures of new maps, drawn when a server changes to one.
  (await import("./lib/overview-watch")).watchServerMaps();
}
