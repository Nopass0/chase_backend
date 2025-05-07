/**
 * SHA‑256 hash helper based on SubtleCrypto running natively in Bun.
 */
export const sha256 = async (text: string): Promise<string> => {
    const buf = new TextEncoder().encode(text)
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Buffer.from(digest).toString('hex')
  }