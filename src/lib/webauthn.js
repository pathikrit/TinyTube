/**
 * Serverless WebAuthn parent gate: we never verify signatures (the adversary
 * is a child, and everything lives in localStorage anyway) — we only rely on
 * the OS refusing to resolve credentials.get() without a successful
 * biometric (userVerification: 'required' on a platform authenticator).
 */

export function toBase64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function fromBase64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer
}

const random = bytes => crypto.getRandomValues(new Uint8Array(bytes))

export async function isBiometricAvailable() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

/** Register the device biometric; returns the credential id (base64url) to store. */
export async function enroll() {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: 'TinyTube', id: location.hostname },
      user: { id: random(16), name: 'parent', displayName: 'Parent' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  })
  return toBase64url(credential.rawId)
}

/** Fire the OS biometric prompt for the stored credential. False on cancel/failed scan. */
export async function verify(credentialIdB64) {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: 'public-key', id: fromBase64url(credentialIdB64) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return assertion !== null
  } catch {
    return false
  }
}
