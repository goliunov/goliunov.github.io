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

  linkedinUrl: "https://www.linkedin.com/in/aleksandergoliunov",

  // Optional. Leave empty to hide. International format, e.g. "+995000000000"
  phone: "+79856804010",

  // WhatsApp username (people find it via search in WhatsApp; a tap-to-chat link needs the phone above)
  whatsappUsername: "@goliunov",

  // Google Calendar appointment schedule (free 15-min assessment booking page)
  bookingUrl: "https://calendar.google.com/calendar/appointments/schedules/AcZssZ383UxpqKadgN1AaYDzJxQbkdTHE_GL1ytrCJ_kE5Tmq9sQW25Mq96tGyLmtQ8T4IsjPv69hDuQ",

  // Reaction test leaderboard: Google Apps Script web app URL (see README)
  reactionApi: "https://script.google.com/macros/s/AKfycbzCBd3rjOstgjtI0Jlijx2n3cD-iQiVibX1E2KkBKiO8uTdvVyjLisZ6KhU1OJvpq-_/exec",

  // PitCRM Apps Script web app: the audit form on /book/ sends leads here (tools/crm_api.gs)
  crmApi: "https://script.google.com/macros/s/AKfycbyZI0IWD9-nbiMME6PE5mJDlkyCOETISCDTr_UNhLzBrl_Ns447TVqONhO74XRdWdZR/exec",

  // Formspree form id, e.g. "myyaabbc" -> https://formspree.io/f/myyaabbc
  formspreeId: "xkjgqyev",

  // Turn this on only after every driver listed agrees to a public mention.
  referencesEnabled: false,

  // Analytics is off by default (no cookies, no tracking scripts).
  // To enable Plausible, uncomment the snippet in index.html <head> and set the domain there.
};
