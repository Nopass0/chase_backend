import { expect, it } from 'bun:test'
import { sha256 } from '@/utils/hash'

it('hashes password deterministically', async () => {
  const a = await sha256('password')
  const b = await sha256('password')
  expect(a).toBe(b)
})