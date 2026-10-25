// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { lazyQuery } from '../../server/utils/lazy-query'

it('defers preparation until first use and reuses the same query', () => {
  const query = { execute: vi.fn() }
  const prepare = vi.fn(() => query)
  const getQuery = lazyQuery(prepare)

  expect(prepare).not.toHaveBeenCalled()
  expect(getQuery()).toBe(query)
  expect(getQuery()).toBe(query)
  expect(prepare).toHaveBeenCalledOnce()
})

it('retries preparation after a failure', () => {
  const query = { execute: vi.fn() }
  const prepare = vi.fn()
    .mockImplementationOnce(() => { throw new Error('not ready') })
    .mockReturnValue(query)
  const getQuery = lazyQuery(prepare)

  expect(() => getQuery()).toThrow('not ready')
  expect(getQuery()).toBe(query)
  expect(getQuery()).toBe(query)
  expect(prepare).toHaveBeenCalledTimes(2)
})
