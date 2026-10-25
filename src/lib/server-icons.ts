// Small icons of the server lists and the map: the game server's operating
// system and its VAC state (hlstats_Servers.server_os, server_vac, filled by
// the collector's features.server_info). Drawn for gameWE (no logo files),
// 1em high and coloured with currentColor, so they fit every skin. Plain
// SVG strings: the map's hover boxes are HTML strings, the tables render
// the same markup.

// Tux-like penguin: head and body with the belly and eyes cut out (so the
// background shows through on every skin), orange beak and feet.
export const LINUX_SVG =
  '<svg class="os-icon" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">' +
  '<path fill="currentColor" fill-rule="evenodd" d="M8 1C5.9 1 4.9 2.8 4.9 4.9c0 1.1-.4 1.9-1.2 3-1 1.4-1.6 2.7-1.6 4 0 1.6 1.3 2.6 2.5 2.6h6.8c1.2 0 2.5-1 2.5-2.6 0-1.3-.6-2.6-1.6-4-.8-1.1-1.2-1.9-1.2-3C11.1 2.8 10.1 1 8 1z' +
  'M8 6.6c-1.4 0-2.2 1.8-2.2 3.8 0 1.7.8 2.7 2.2 2.7s2.2-1 2.2-2.7c0-2-.8-3.8-2.2-3.8z' +
  'M6.8 3.2a.7.7 0 1 0 0 1.4.7.7 0 1 0 0-1.4zM9.2 3.2a.7.7 0 1 0 0 1.4.7.7 0 1 0 0-1.4z"/>' +
  '<path fill="#f5a800" d="M6.9 5.1h2.2L8 6.4zM3.2 13.4c.4-.9 1.7-1 2.6-.4l.5 1.6c-.9.6-2.6.3-3.1-1.2zM12.8 13.4c-.4-.9-1.7-1-2.6-.4l-.5 1.6c.9.6 2.6.3 3.1-1.2z"/>' +
  "</svg>";

// Four panes of a window, slightly in perspective.
export const WINDOWS_SVG =
  '<svg class="os-icon" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">' +
  '<path fill="currentColor" d="M1.5 3.1l5.3-.8v5.1H1.5zM7.8 2.2l6.7-1v6.2H7.8zM1.5 8.5h5.3v5.1l-5.3-.8zM7.8 8.5h6.7v6.2l-6.7-1z"/>' +
  "</svg>";

// A shield outline with "VAC" in it: the server is VAC-secured.
export const VAC_SVG =
  '<svg class="vac-icon" viewBox="0 0 24 26" width="1.15em" height="1.25em" aria-hidden="true">' +
  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 1.5l9.3 3.3v7.4c0 6-4 10.3-9.3 12.3-5.3-2-9.3-6.3-9.3-12.3V4.8z"/>' +
  '<text x="12" y="15.6" fill="currentColor" font-family="Arial, Helvetica, sans-serif" font-size="8.2" font-weight="700" text-anchor="middle" letter-spacing="-.3">VAC</text>' +
  "</svg>";
