/// <reference types="node" />

export interface VCancel {
  (): void
}
export interface Cancel<V> {
  (dataOrError?: V | Error): void
}
export interface CacheGenerator<V extends object> {
  (key: string, callback: (err: Error, value?: V) => void): VCancel | void;
}
export interface CacheMultiGenerator<V extends object> {
  (keys: string[], callback: (err: Error, ret?: {[key: string]: V}) => void): VCancel | void;
}

declare class LRUWeakCache<V extends object> extends Map<string, V> {
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
  generate(key: string, generator: CacheGenerator<V>, callback: (err: Error, value?: V) => void): Cancel<V>;
  /**
   * Asynchroniously generate multiple values for a given key with a callback.
   * This method can be called multiple times, or in conjunction with {@see generate} and only calls the generator once per key for the specified caching settings.
   *
   * @param keys The keys to use
   * @param generator The generator to generate the values using
   * @param callback The callback to call when finished
   */
  generateMulti(keys: string[], generator: CacheMultiGenerator<V>, callback: (err: Error, ret?: {[key: string]: V}) => void): Cancel<{[index:string]:V}>;
  /**
   * Efficiently set multiple values while maintaining the capacity and other settings
   */
  setMulti(data: {[index: string]: V}): this;
  /**
   * Trim least-recently-used items from this map.
   *
   * @param by The amount to trim by
   */
   trim(by: number): this;
}
