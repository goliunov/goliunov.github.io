/**
 * Single place to edit contacts, links and feature flags.
 * Anything left as a `[PLACEHOLDER]` string is treated as "not set yet"
 * and the corresponding UI element is hidden automatically — fill it in
 * and it will appear on next reload. See README.md for details.
 */
const CONFIG = {
  name: "Aleksander Goliunov",
  email: "aleksandrgoliunov@yahoo.com",

  instagramHandle: "@a.goliunov",
  instagramUrl: "https://instagram.com/a.goliunov",

  telegramUrl: "https://t.me/goliunov",

  // Optional. Leave empty to hide. International format, e.g. "+995000000000"
  phone: "",

  // Formspree form id, e.g. "myyaabbc" -> https://formspree.io/f/myyaabbc
  formspreeId: "xkjgqyev",

  // Turn this on only after every driver listed agrees to a public mention.
  referencesEnabled: false,

  // Analytics is off by default (no cookies, no tracking scripts).
  // To enable Plausible, uncomment the snippet in index.html <head> and set the domain there.
};
