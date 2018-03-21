/// <reference types="node" />

module "lru-weak-cache" {
  declare class LRUWeakCache<V extends object> extends Map<string, V> {
    constructor(options: {timeout?:number,capacity?:number,retimeOnAccess?:boolean});
    generate(key: string, generator: (key: string, callback: (err: Error, value?: V) => void) => void, callback: (err: Error, value?: V) => void): void;
  }
  export = LRUWeakCache;
}
