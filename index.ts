/// <reference types="node" />

import { LRUWeakCache as ILRUWeakCache, CacheGenerator, CacheMultiGenerator } from "./types";
import weak = require("weak");

export = class LRUWeakCache<V extends object> extends Map<string, V> implements ILRUWeakCache<V> {
  private accesses: {[index: string]: number};
  private timeouts: {[index: string]: number};
  private weakeners: {[index: string]: number};
  private destructors: {[index: string]: () => void} = {};
  private generateQueue: {[index: string]: ((err: Error, value?: V) => void)[]} = {};
  private resetTimersOnAccess: boolean;
  private capacity: number;
  private minAge: number;
  private maxAge: number;

  constructor(options: number | {maxAge?:number,minAge?:number,capacity?:number,resetTimersOnAccess?:boolean} = 200) {
    super();
    if(typeof options === "number")
      options = {capacity:options};
    this.resetTimersOnAccess = options.resetTimersOnAccess;
    this.capacity = options.capacity;
    this.minAge = options.minAge;
    this.maxAge = options.maxAge;
    if(this.minAge > 0)
      this.weakeners = {};
    if(this.maxAge > 0)
      this.timeouts = {};
    if(this.capacity > 0)
      this.accesses = {};
  }
	clear(): void {
    this.destructors = {};
    try {
      const timeouts = this.timeouts;
      Object.keys(timeouts).forEach(function(key) {
        try{clearTimeout(timeouts[key]);}catch(e){}
      });
      this.timeouts = {};
    } catch(e) {}
    try {
      const weakeners = this.weakeners;
      Object.keys(weakeners).forEach(function(key) {
        try{clearTimeout(weakeners[key]);}catch(e){}
      });
      this.weakeners = {};
    } catch(e) {}
    try {
      this.accesses = {};
    } catch(e) {}
    super.clear();
	}
	delete(key: string): boolean{
    delete this.destructors[key];
    try{
      const timeouts = this.timeouts;
      clearTimeout(timeouts[key]);
      delete timeouts[key];
    }catch(e){}
    try {
      delete this.accesses[key];
    } catch(e) {}
    return super.delete(key);
	}
  private makeDestruct(key: string) {
    const self = this;
    const destructor = function() {
      if (self.destructors[key] === destructor)
        self.delete(key);
    };
    return destructor;
  }
	set(key: string, value: V): this{
    const capacity = this.capacity;
    const over = (this.size - this.capacity) + 1;
    if(over > 0) {
      const accesses = this.accesses;
      const keys = Array.from(this.keys());
      keys.sort(function(a, b) {
        return accesses[a] - accesses[b];
      });
      for(var i=0; i<over; i++)
        this.delete(keys[i]);
    }

    const self = this;
    const destructor = this.makeDestruct(key);
    this.destructors[key] = destructor;
    const timeouts = this.timeouts;
    if(timeouts) {
      try {clearTimeout(timeouts[key]);} catch(e) {}
      timeouts[key] = setTimeout(destructor, this.maxAge) as any;
    }
    try {
      this.accesses[key] = +new Date;
    } catch(e) {}
    try {
      const weakeners = this.weakeners;
      try {clearTimeout(weakeners[key]);} catch(e) {}
      weakeners[key] = setTimeout(function() {
        Map.prototype.set.call(self, key, weak(value, destructor) as any);
      }, this.minAge) as any;
      return super.set(key, value);
    } catch(e) {
      return super.set(key, weak(value, destructor) as any);
    }
	}
  get(key: string): V{
    var val = super.get(key);
    if(val) {
      if(this.resetTimersOnAccess) {
        try {
          const timeouts = this.timeouts;
          clearTimeout(timeouts[key]);
          timeouts[key] = setTimeout(this.destructors[key], this.maxAge) as any;
        } catch(e) {}
        try {
          const self = this;
          const weakeners = this.weakeners;
          try {super.set(key, val = weak.get(val));} catch(e) {}
          clearTimeout(weakeners[key]);
          weakeners[key] = setTimeout(function() {
            Map.prototype.set.call(self, key, weak(val, self.destructors[key]) as any);
          }, this.minAge) as any;
        } catch(e) {}
      }
      try {
        this.accesses[key] = +new Date;
      } catch(e) {}
      try {
        return weak.get(val);
      } catch(e) {}
    }
    return val;
  }
  forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void, thisArg?: any) {
    super.forEach(function(value, key, map) {
      try {
        value = weak.get(value);
      } catch(e) {}
      callbackfn.call(this, value, key, map);
    }, thisArg);
  }
  generate(key: string, generator: CacheGenerator<V>, callback: (err: Error, value?: V) => void) {
    const val = this.get(key);
    if(val === undefined) {
      const generateQueue = this.generateQueue;
      var keyQueue = generateQueue[key];
      if(keyQueue)
        keyQueue.push(callback);
      else {
        const self = this;
        keyQueue = generateQueue[key] = [callback];
        generator(key, function(err, value) {
          delete generateQueue[key];
          if (err)
            keyQueue.forEach(function(callback) {
              callback(err);
            });
          else {
            if (value)
              self.set(key, value);
            keyQueue.forEach(function(callback) {
              callback(undefined, value);
            });
          }
        });
      }
    } else
      callback(undefined, val);
  }
  generateMulti(keys: string[], generator: CacheMultiGenerator<V>, callback: (err: Error, ret?: { [key: string]: V }) => void): void {
    if (keys.length) {
      var remaining = keys.length;
      const ret = {};
      const done = function(key: string, val: V | Error) {
        ret[key] = val;
        if (!--remaining) {
          var err: Error;
          Object.keys(ret).forEach(function(key) {
            const val = ret[key];
            if(val instanceof Error) {
              if(err) {
                if(err.message !== val.message) {
                  if (!err['multi']) {
                    console.warn(err);
                    err = new Error("Multiple errors occured, see log");
                    err['multi'] = true;
                  }
                  console.warn(val);
                }
              } else
                err = val;
            }
          });
          if(err)
            callback(err);
          else
            callback(undefined, ret);
        }
      };
      const self = this;
      const unusedKeys = [];
      const generateQueue = this.generateQueue;
      keys.forEach(function(key) {
        const keyQueue = generateQueue[key];
        if (keyQueue) {
          keyQueue.push(function(err, value) {
            done(key, err || value);
          });
        } else
          unusedKeys.push(key);
      });

      if (unusedKeys.length) {
        unusedKeys.forEach(function(key) {
          generateQueue[key] = [];
        });
        const finished = function(ret) {
          unusedKeys.forEach(function(key) {
            const value = ret[key];
            const isError = value instanceof Error;
            if (!isError && value)
              self.set(key, value);
            generateQueue[key].forEach(function(cb) {
              if (isError)
                cb(value);
              else
                cb(undefined, value);
            });
            if (isError)
              generateQueue[key] = {
                push: function(cb) {
                  cb(value);
                }
              } as any;
            else
              generateQueue[key] = {
                push: function(cb) {
                  cb(undefined, value);
                }
              } as any;
          })
        };
        if (unusedKeys.length == keys.length)
          generator(keys, function(err, ret) {
            if (err)
              callback(err);
            else {
              if(!ret)
                ret = {};
              finished(ret);
              callback(undefined, ret);
            }
          });
        else
          generator(keys, function(err, ret) {
            finished(ret);
            unusedKeys.forEach(function(key) {
              done(key, err || (ret && ret[key]));
            });
          });
      }
    } else
      callback(undefined, {});
  }
  entries(): IterableIterator<[string, V]>{
      const it = super.entries();
      const next = it.next;
      (it as any).next = function() {
        const n = next.apply(it, arguments);
        try {
          n.value[1] = weak.get(n.value[1]);
        } catch(e) {}
        return n;
      }
      return it;
  }
  values(): IterableIterator<V>{
    const it = super.values();
    const next = it.next;
    (it as any).next = function() {
      const n = next.apply(it, arguments);
      try {
        n.value = weak.get(n.value);
      } catch(e) {}
      return n;
    }
    return it;
  }
}
