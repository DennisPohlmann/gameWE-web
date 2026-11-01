# Accessibility

The gameWE website should be usable by everyone, including people who use a
keyboard instead of a mouse, a screen reader, zoom or a high contrast setting,
and on small phone screens.

## Goals

- Work in current desktop and mobile browsers, from about 360 px wide.
- Follow the [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
  at level AA as the target for the built-in skins: text alternatives for
  images and charts where they carry information, enough color contrast, a
  visible keyboard focus, sensible headings and labels, and no content that
  works only on hover.
- Keep motion optional: parts of a page that fade and slide in while
  scrolling, smooth scrolling and hover effects are off when the system asks
  for reduced motion, and without JavaScript everything is shown at once.

gameWE has not had a formal accessibility audit. Some pages, for example kill
heatmaps and world maps, are visual by nature; their key numbers should also
be readable as text.

Extra skins from [gameWE-web-content](https://github.com/DennisPohlmann/gameWE-web-content)
and site operators' own templates may differ from the built-in skins.

## Reporting a problem

Accessibility problems are bugs. Please open a
[bug report](https://github.com/DennisPohlmann/gameWE-web/issues/new?template=bug_report.yml)
and tell us:

- the page (URL path) and the skin;
- the browser, the operating system and the assistive technology you use
  (for example NVDA, VoiceOver or TalkBack), with versions;
- what you expected and what happened.

If you run a gameWE site and a visitor reports a problem to you, you are
welcome to forward it here.
