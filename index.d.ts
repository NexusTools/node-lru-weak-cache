/// <reference types="node" />

module lru_weak_cache {
  declare interface LRUWeakCacheGenerator {
    (key: string, callback: (err: Error, value?: V) => void): void;
  }
  declare interface LRUWeakCache<V extends object> extends Map<string, V> {
    generate(key: string, generator: LRUWeakCacheGenerator, callback: (err: Error, value?: V) => void): void;
  }
  declare interface LRUWeakCacheConstructor {
    new (options: {timeout?: number,capacity?: number,retimeOnAccess?:boolean}): LRUWeakCache;
  }
  declare var LRUWeakCache: LRUWeakCacheConstructor;
}
module "lru-weak-cache" {
  export = lru_weak_cache.LRUWeakCacheConstructor;
}
