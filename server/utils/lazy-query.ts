export function lazyQuery<T>(prepare: () => T) {
  let query: T | undefined
  return () => query ??= prepare()
}
