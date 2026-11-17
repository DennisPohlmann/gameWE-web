import type { L } from "./admin-entities";

// The longer explanations behind the "?" next to a setting
// (components/admin/help-tip.tsx), by setting key. Only what the collector
// and the website really do: collector internal/settings, internal/stats
// (points.go, store.go, inactive.go), internal/collector (processor.go,
// commands.go); website lib/format.ts (activity). The translations are in
// translations/admin/help.ts.
export const SETTING_INFO: Record<string, L> = {
  MinActivity: {
    de: "Nach dem letzten Spiel sinkt die Aktivität eines Spielers gleichmäßig von 100 % auf 0 %. Bei 28 Tagen liegt sie nach 14 Tagen ohne Spiel bei 50 %. Wer so lange nicht gespielt hat und gerade nicht online ist, wird einmal am Tag zu den inaktiven Spielern verschoben und erscheint nicht mehr in den Ranglisten (Collector: features.inactive_players, standardmäßig an). Sobald er wieder spielt, ist er zurück.",
    en: "After the last game a player's activity drops evenly from 100 % to 0 %. With 28 days it is at 50 % after 14 days without play. Players who have not played for that long and are not online are moved to the inactive players once a day and no longer appear in the rankings (collector: features.inactive_players, on by default). As soon as they play again, they are back.",
  },
  gamewe_start_skill: {
    de: "Mit diesem Wert beginnt jeder neue Spieler. Mit demselben Wert starten alle Spieler nach dem Zurücksetzen einer Rangliste und ein Spieler, der seine Stats im Spiel mit !gamewe_reset zurücksetzt. Standard: 1000.",
    en: "Every new player starts with this value. All players start with it again after a ranking is reset, and so does a player who resets their own stats in game with !gamewe_reset. Default: 1000.",
  },
  gamewe_kill_points: {
    de: "So berechnet der Collector einen Kill: dieser Wert × Faktor der Waffe × Punkte des Opfers ÷ Punkte des Killers, gerundet, mindestens 1 und höchstens das Vierfache dieses Werts. Der Killer bekommt die Punkte, das Opfer verliert genauso viele, fällt aber nie unter 0. Beispiel mit 5 und Faktor 1: Sind beide gleich stark, gibt es 5 Punkte, hat das Opfer doppelt so viele Punkte wie der Killer, gibt es 10. Standard: 5.",
    en: "This is how the collector scores a kill: this value × the weapon's modifier × the victim's points ÷ the killer's points, rounded, at least 1 and at most four times this value. The killer gains these points and the victim loses as many, but never drops below 0. Example with 5 and modifier 1: equally strong players give 5 points, a victim with twice the killer's points gives 10. Default: 5.",
  },
  gamewe_headshot_bonus: {
    de: "Zusätzliche Punkte für den Killer bei einem Kopfschuss, zu den Punkten des Kills dazu. Das Opfer verliert dadurch nicht mehr. Der Standard ist 0, weil die Aktion headshot unter Aktionen den Kopfschuss in den mitgelieferten Vorlagen schon belohnt. Ein Wert hier kommt noch obendrauf.",
    en: "Extra points for the killer on a headshot, on top of the points of the kill. The victim does not lose more for it. The default is 0 because the action headshot under Actions already rewards headshots in the built-in presets. A value here comes on top of that.",
  },
  gamewe_suicide_penalty: {
    de: "So viele Punkte verliert ein Spieler bei einem Selbstmord, aber nie unter 0. Standard: 5.",
    en: "A suicide costs the player this many points, but never below 0. Default: 5.",
  },
  gamewe_teamkill_penalty: {
    de: "So viele Punkte verliert der Killer bei einem Teamkill, aber nie unter 0. Kill-Punkte gibt es dafür keine, und das Opfer behält seine Punkte. Standard: 10.",
    en: "A teamkill costs the killer this many points, but never below 0. It earns no kill points, and the victim keeps their points. Default: 10.",
  },
  gamewe_win_triggers: {
    de: "Steht einer dieser Trigger im Log eines Servers, endet die Runde mit einem Sieger. Die Spieler des siegreichen Teams bekommen einen Sieg, die übrigen eine Niederlage, und der Server zählt die Runde. Ist die passende Aktion eine Team-Aktion mit Bonus, bekommt jeder im Siegerteam diesen Bonus. Groß- und Kleinschreibung spielt keine Rolle. Standard: CTs_Win, Terrorists_Win, Target_Bombed, Target_Saved, Bomb_Defused, All_Hostages_Rescued, Hostages_Not_Rescued, VIP_Escaped, VIP_Assassinated, VIP_Not_Escaped, Round_Win.",
    en: "When one of these triggers appears in a server's log, the round ends with a winner. The players of the winning team get a win, the others a loss, and the server counts the round. If the matching action is a team action with a bonus, everyone in the winning team gets that bonus. Upper and lower case do not matter. Default: CTs_Win, Terrorists_Win, Target_Bombed, Target_Saved, Bomb_Defused, All_Hostages_Rescued, Hostages_Not_Rescued, VIP_Escaped, VIP_Assassinated, VIP_Not_Escaped, Round_Win.",
  },
  gamewe_idle_timeout: {
    de: "Geht die Abmeldung eines Spielers verloren, etwa weil der Server abstürzt, beendet der Collector den Besuch, sobald so lange keine Logzeile mehr von ihm kam. Die Spielzeit zählt bis dahin mit. Bei Bots geschieht das spätestens nach 3 Minuten. Standard: 300 Sekunden.",
    en: "If a player's disconnect gets lost, for example because the server crashes, the collector ends the visit once no log line has come from that player for this long. The playing time counts up to then. For bots this happens after 3 minutes at the latest. Default: 300 seconds.",
  },
  gamewe_commands: {
    de: "Schreibt ein Spieler !rank, !top10 oder einen ähnlichen Befehl in den Chat, antwortet der Collector über RCON. Dafür muss beim Server das RCON-Passwort eingetragen sein. Wie die Antwort aussieht, legen die Einstellungen darunter fest. Anzeigen kann die Antwort nur das gameWE-Plugin auf dem Gameserver (SourceMod, AMX Mod X oder CS2) oder, mit dem Präfix gameme, ein gameME-Plugin. Ohne Plugin erscheint nichts. Ist das hier aus, gehen auch keine Punkte mehr in Konsole und Chat. In der Config des Plugins steht nur, was das Plugin selbst macht, etwa das Nachrichten-Präfix und die Wartezeit zwischen zwei Befehlen.",
    en: "When a player types !rank, !top10 or a similar command in the chat, the collector answers over RCON. The server needs its RCON password for that. The settings below decide what the answer looks like. Only the gameWE plugin on the game server (SourceMod, AMX Mod X or CS2) can show the answer, or a gameME plugin with the prefix gameme; without a plugin nothing appears. When this is off, no points go to the console or the chat either. The plugin's own config only holds what the plugin does itself, such as the message prefix and the wait between two commands.",
  },
  gamewe_menu_time: {
    de: "So viele Sekunden bleibt das Panel mit der Antwort auf !top10, !rank und Co. beim Spieler offen. Standard: 15.",
    en: "How many seconds the panel with the answer to !top10, !rank and the like stays open for the player. Default: 15.",
  },
  gamewe_rcon_timeout: {
    de: "So lange wartet der Collector bei RCON auf den Verbindungsaufbau, das Senden und die Antwort, etwa bei den Antworten auf Befehle und bei der Statusabfrage der Server. Reagiert ein Server nicht rechtzeitig, bricht er ab. Standard: 5 Sekunden.",
    en: "How long the collector waits over RCON to connect, send and receive, for example for the answers to commands and for the status query of the servers. If a server does not respond in time, it gives up. Default: 5 seconds.",
  },
  gamewe_command_display: {
    de: "Gilt für !rank, !statsme, !session, !status und !next. Panel: ein Menü links auf dem Bildschirm, wie bei gameME. Chat: Zeilen im Chat. Beides: Panel und Chat zugleich.",
    en: "Applies to !rank, !statsme, !session, !status and !next. Panel: a menu on the left of the screen, as in gameME. Chat: lines in the chat. Both: panel and chat at the same time.",
  },
  gamewe_command_prefix: {
    de: "Mit diesen Befehlen steuert der Collector das Plugin auf dem Server, zum Beispiel gamewe_psay für eine Zeile im Chat. Wähle gameme nur für Server, auf denen noch das originale gameME-Plugin läuft.",
    en: "With these commands the collector drives the plugin on the server, for example gamewe_psay for a line in the chat. Choose gameme only for servers that still run the original gameME plugin.",
  },
  gamewe_raw_messages: {
    de: "Die Antworten auf !rank, !session, !top10 und !next gehen dann als Raw-Message (gamewe_raw_message) an ein Nachrichten-Plugin auf dem Server, das sie selbst darstellt. Schalte das nur ein, wenn ein solches Plugin läuft. Das klappt nur auf SourceMod-Servern. AMX-Mod-X- und CS2-Server bekommen weiter normalen Chattext.",
    en: "The answers to !rank, !session, !top10 and !next then go as a raw message (gamewe_raw_message) to a message plugin on the server, which shows them itself. Only switch this on when such a plugin runs. This only works on SourceMod servers: AMX Mod X and CS2 servers keep getting chat text.",
  },
  gamewe_console_events: {
    de: "Die Zeilen zeigt das gameWE-Plugin auf dem Gameserver an (SourceMod, AMX Mod X oder CS2), ohne Plugin erscheint nichts. Ist das hier an, bekommt sie jeder Spieler, bis er sie selbst mit !gamewe_display 0 abschaltet (wieder an mit !gamewe_display 1). Ist es aus, bekommt sie niemand, egal was der Spieler eingestellt hat. Aus ist es auch, wenn Befehle im Spiel nicht beantwortet werden (Einstellung weiter oben). In der Config des Plugins gibt es dafür keinen Schalter.",
    en: "The gameWE plugin on the game server (SourceMod, AMX Mod X or CS2) shows these lines; without it nothing appears. When this is on, every player gets them until they turn them off with !gamewe_display 0 (back on with !gamewe_display 1). When this is off, nobody gets them, whatever the player has chosen. They are also off when in-game commands are not answered (setting above). The plugin's config has no switch for this.",
  },
  gamewe_global_chat: {
    de: "Die Ansagen zeigt das gameWE-Plugin auf dem Gameserver an (SourceMod, AMX Mod X oder CS2), ohne Plugin erscheint nichts. Ist das hier an, sieht sie jeder Spieler, bis er sie selbst mit !gamewe_chat 0 abschaltet (wieder an mit !gamewe_chat 1). Ist es aus, sieht sie niemand, egal was der Spieler eingestellt hat. Aus ist es auch, wenn Befehle im Spiel nicht beantwortet werden (Einstellung weiter oben). In der Config des Plugins gibt es dafür keinen Schalter.",
    en: "The gameWE plugin on the game server (SourceMod, AMX Mod X or CS2) shows these announcements; without it nothing appears. When this is on, every player sees them until they turn them off with !gamewe_chat 0 (back on with !gamewe_chat 1). When this is off, nobody sees them, whatever the player has chosen. They are also off when in-game commands are not answered (setting above). The plugin's config has no switch for this.",
  },
};

// The label of the "?" button.
export const HELP_T = { de: { more: "Mehr zu „{f}“" }, en: { more: "More about “{f}”" } };
