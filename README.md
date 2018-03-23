[![Package Version](https://img.shields.io/npm/v/lru-weak-cache.svg)](https://www.npmjs.org/package/lru-weak-cache) [![Build Status](https://travis-ci.org/NexusTools/node-lru-weak-cache.svg)](https://travis-ci.org/NexusTools/node-lru-weak-cache) [![Coverage Status](https://img.shields.io/coveralls/NexusTools/node-lru-weak-cache.svg)](https://coveralls.io/r/NexusTools/node-lru-weak-cache?branch=master) [![Apache License 2.0](http://img.shields.io/hexpm/l/plug.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)

node-lru-weak-cache
-------------------
A caching Map<string, V extends object> that deletes the least-recently-used items with weak references and async generation.
Inspired by [lru-cache](https://www.npmjs.com/package/lru-cache).

```bash
npm install lru-weak-cache
```

```typescript
declare interface CacheGenerator<V extends Object> {
  (key: string, callback: (err: Error, value?: V) => void): void;
}
declare interface CacheMultiGenerator<V extends Object> {
  (keys: string[], callback: (err: Error, ret?: {[key: string]: V}) => void): void;
}

export = class LRUWeakCache<V extends object> extends Map<string, V> {
  /**
   * Construct a new LRUWeakCache instance.
   *
   * @param options A number specifying the capacity, or a object of options, if nothing is provided, a capacity of 200 is used by default
   * @param options.minAge The minimum time in milliseconds an item can exist before being allowed to be garbage collected
   * @param options.maxAge The maximum time in milliseconds an object can exist before being erased, this should be higher than minAge or minAge will have no affect
   * @param options.capacity The maximum number of items this cache can contain before it starts erasing old ones
   * @param options.resetTimersOnAccess Whether or not to reset the minAge and maxAge timers when an item is accessed
   */
  constructor(options: number | {minAge?:number,maxAge?:number,capacity?:number,resetTimersOnAccess?:boolean});
  /**
   * Asynchroniously generate a value for a given key with a callback.
   * This method can be called multiple times, or in conjunction with {@see generateMulti} and only calls the generator once per key for the specified caching settings.
   *
   * @param key The key to use
   * @param generator The generator to generate the value using
   * @param callback The callback to call when finished
   */
  generate(key: string, generator: CacheGenerator<V>, callback: (err: Error, value?: V) => void): void;
  /**
   * Asynchroniously generate multiple values for a given key with a callback.
   * This method can be called multiple times, or in conjunction with {@see generate} and only calls the generator once per key for the specified caching settings.
   *
   * @param keys The keys to use
   * @param generator The generator to generate the values using
   * @param callback The callback to call when finished
   */
  generateMulti(keys: string[], generator: CacheMultiGenerator<V>, callback: (err: Error, ret?: {[key: string]: V}) => void): void;
}
```

legal
-----
node-lru-weak-cache is licensed under [Apache License 2.0](LICENSE.md)
