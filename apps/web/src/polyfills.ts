// Safari/iOS before 15.4 lacks these; some dependencies call them at runtime.
function at<T>(this: ArrayLike<T>, index: number): T | undefined {
  const n = Math.trunc(index) || 0;
  const i = n < 0 ? this.length + n : n;
  return i < 0 || i >= this.length ? undefined : this[i];
}

for (const proto of [Array.prototype, String.prototype, Object.getPrototypeOf(Int8Array.prototype)]) {
  if (!('at' in proto)) Object.defineProperty(proto, 'at', { value: at, writable: true, configurable: true });
}

if (!('hasOwn' in (Object as object))) {
  Object.defineProperty(Object as object, 'hasOwn', {
    value: (target: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(target, key),
    writable: true,
    configurable: true,
  });
}

export {};
