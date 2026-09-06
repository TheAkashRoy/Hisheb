export const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim())

// People keep typing an email address into the "name" field instead of the
// separate email field - which used to create a placeholder literally
// *named* "someone@example.com" with no account link, so the invited
// person never saw the group. If the name looks like an email and no
// explicit invite email was given, treat the name AS the invite email and
// derive a readable name from its local part.
export function splitNameOrEmail(name, inviteEmail) {
  const n = String(name || '').trim()
  const e = inviteEmail ? String(inviteEmail).trim() : ''
  if (!e && looksLikeEmail(n)) return { name: n.split('@')[0], inviteEmail: n }
  return { name: n, inviteEmail: e || undefined }
}
