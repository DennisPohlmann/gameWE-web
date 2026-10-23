// URL prefix when the site runs under a sub path (BASE_PATH=/new at build
// time, see next.config.ts). Empty at the root. Link and redirect() add it on
// their own; plain <a href>, cookie paths and absolute URLs need it.
export const basePath = process.env.BASE_PATH ?? "";
