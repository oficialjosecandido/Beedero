/**
 * Sending a connection request needs the sender's ladder rungs 1–4 (backend
 * accounts/ladder.py). The API answers 403 with `code: "profile_locked"`;
 * screens that know it in advance (`can_request`, `can_connect`) explain it
 * before offering a button that would fail. Client-safe: copy only.
 */
export const LOCKED_TITLE = "Finish your profile to connect";
export const LOCKED_BODY =
  "Add who you are, a photo with a few lines about your work, and one role with three skills. It takes a couple of minutes — importing from LinkedIn brings the roles.";
