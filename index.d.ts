/// <reference types="node" />

module "lru-weak-cache" {
  declare class LRUWeakCache<V extends object> extends Map<string, V> {
    /**
     * Construct a new LRUWeakCache instance.
     *
     * @param options A number specifying the capacity, or a object of options, if nothing is provided, a capacity of 200 is used by default
     * @param options.timeout The time in milliseconds an object can exist before being erased
     * @param options.capacity The maximum number of items this cache can contain before it starts erasing old ones
     * @param options.lifetime The minimum time in milliseconds an item can exist before being allowed to be garbage collected
     * @param options.retimeOnAccess Whether or not to reset the timeout timer when an item is accessed
     * @param options.reliveOnAccess Whether or not to reset the lifetime timer when an item is accessed
     */
    constructor(options: number | {timeout?:number,capacity?:number,lifetime?:number,retimeOnAccess?:boolean,reliveOnAccess?:boolean});
    generate(key: string, generator: (key: string, callback: (err: Error, value?: V) => void) => void, callback: (err: Error, value?: V) => void): void;
  }
  export = LRUWeakCache;
}
