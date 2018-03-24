/// <reference types="node" />

import { LRUWeakCache as ILRUWeakCache, CacheGenerator, CacheMultiGenerator, VCancel, Cancel } from "./types";
import weak = require("weak");

interface GeneratorCallback<V extends object> {
  (err: Error, value?: V): void;
}
interface GeneratorQueue<V extends object> extends Array<GeneratorCallback<V>> {
  cancel: Cancel<V>;
}

const findError = function(data: {[index:string]:any}) {
  var err: Error;
  Object.keys(data).forEach(function(key) {
    const val = data[key];
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
  return err;
}

interface SetStep {
  (): void;
}

const noop = function() {}
export = class LRUWeakCache<V extends object> extends Map<string, V> implements ILRUWeakCache<V> {
  private accesses: {[index: string]: number};
  private timeouts: {[index: string]: number};
  private weakeners: {[index: string]: number};
  private destructors: {[index: string]: () => void} = {};
  private generateQueue: {[index: string]: GeneratorQueue<V>} = {};
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
    const generateQueue = this.generateQueue;
    Object.keys(generateQueue).forEach(function(key) {
      generateQueue[key].cancel();
    });
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
    const queue = this.generateQueue[key];
    if (queue)
      queue.cancel();
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
  trim(by: number) {
    const accesses = this.accesses;
    const keys = Array.from(this.keys());
    keys.sort(function(a, b) {
      return accesses[a] - accesses[b];
    });
    for(var i=0; i<by; i++)
      this.delete(keys[i]);
    return this;
  }
  setMulti(data: {[index: string]: V}): this{
    const self = this;
    const toset: {[index: string]: V} = {};
    Object.keys(data).forEach(function(key) {
      const val = data[key];
      if(val && val !== Map.prototype.get.call(self, key))
        toset[key] = val;
      else
        self.delete(key);
    });
    const keys = Object.keys(toset);
    const length = keys.length;
    if(length) {
      const capacity = this.capacity;
      const over = (this.size - this.capacity) + length;
      if(over > 0)
        this.trim(over);

      const accesses = this.accesses;
      const timeouts = this.timeouts;
      const weakeners = this.weakeners;
      const generateQueue = this.generateQueue;
      const set = Map.prototype.set;
      keys.forEach(function(key) {
        const value = toset[key];
        const queue = generateQueue[key];
        if (queue)
          queue.cancel(value);
        const destructor = self.makeDestruct(key);
        self.destructors[key] = destructor;
        if(timeouts) {
          try {clearTimeout(timeouts[key]);} catch(e) {}
          timeouts[key] = setTimeout(destructor, self.maxAge) as any;
        }
        try {
          accesses[key] = +new Date;
        } catch(e) {}
        try {
          try {clearTimeout(weakeners[key]);} catch(e) {}
          weakeners[key] = setTimeout(function() {
            set.call(self, key, weak(value, destructor) as any);
          }, self.minAge) as any;
          set.call(self, key, value);
        } catch(e) {
          set.call(self, key, weak(value, destructor) as any);
        }
      });
    }
    return this;
  }
	set(key: string, value: V): this{
    var cvalue = super.get(key);
    try {cvalue=weak.get(cvalue);} catch(e) {}
    if (cvalue === value)
      return;

    const capacity = this.capacity;
    const over = (this.size - this.capacity) + 1;
    if(over > 0)
      this.trim(over);

    const generateQueue = this.generateQueue;
    const queue = generateQueue[key];
    if (queue)
      queue.cancel(value);

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
  generate(key: string, generator: CacheGenerator<V>, callback: (err: Error, value?: V) => void): Cancel<V>{
    const val = this.get(key);
    if(val === undefined) {
      const generateQueue = this.generateQueue;
      var keyQueue = generateQueue[key];
      if(keyQueue)
        keyQueue.push(callback);
      else {
        const self = this;
        var finished: boolean;
        const finish = function(err: Error, value?: V) {
          if(finished)
            return;
          finished = true;
          if (generateQueue[key] === keyQueue)
            delete generateQueue[key];
          if (err)
            keyQueue.forEach(function(callback) {
              callback(err);
            });
          else {
            if (value && !generateQueue[key])
              self.set(key, value);
            keyQueue.forEach(function(callback) {
              callback(undefined, value);
            });
          }
        }
        var retCancel: VCancel;
        keyQueue = generateQueue[key] = [callback] as any;
        keyQueue.cancel = function(data) {
          if (data instanceof Error)
            finish(data);
          else
            finish(undefined, data);
          if (retCancel)
            retCancel();
        }
        retCancel = generator(key, finish) as VCancel;
      }
      return keyQueue.cancel;
    }
    callback(undefined, val);
    return noop;
  }
  generateMulti(keys: string[], generator: CacheMultiGenerator<V>, callback: (err: Error, ret?: { [key: string]: V }) => void): Cancel<{[index:string]:V}>{
    if (keys.length) {
      const self = this;
      const unusedKeys = [];
      var finished: boolean;
      var remaining = keys.length;
      const cancelledKeys: string[] = [];
      const ret: { [key: string]: V | Error } = {};
      const retKeys: {[index: string]: boolean} = {};
      const keyCancels: {[index:string]:Cancel<V>} = {};
      const queues: {[index: string]: GeneratorQueue<V>} = {};
      const writeUnusedKeys = function(ret, err?) {
        if (err)
          keys.forEach(function(key) {
            const queue = queues[key];
            if (queue === generateQueue[key])
              delete generateQueue[key];
            if (queue)
              queue.forEach(function(cb) {
                cb(err);
              });
          });
        else {
          const toset = {};
          keys.forEach(function(key) {
            const queue = queues[key];
            if (queue === generateQueue[key])
              delete generateQueue[key];
            const value = ret[key];
            if(value && !generateQueue[key])
              toset[key] = value as V;
            if (queue)
              queue.forEach(function(cb) {
                cb(undefined, value as V);
              });
          });
          self.setMulti(toset);
        }
      }
      var done = function(key: string, val: V | Error) {
        if (finished)
          return;
        if (val)
          ret[key] = val;
        if(retKeys[key])
          return;
        retKeys[key] = true;
        if (!--remaining) {
          finished = true;
          var err = findError(ret);
          writeUnusedKeys(ret, err);
          if(err)
            callback(err);
          else
            callback(undefined, ret as any);
        }
      };
      const generateQueue = this.generateQueue;
      keys.forEach(function(key) {
        const val = self.get(key);
        if (val)
          done(key, val);
        else {
          const keyQueue = generateQueue[key];
          if (keyQueue) {
            var cancelled: boolean;
            var origCancel = keyQueue.cancel;
            (queues[key] = (generateQueue[key] = keyQueue.splice(0, keyQueue.length, function(err, value) {
              if (!cancelled)
                done(key, err || value);
            }) as any)).cancel = keyCancels[key] = function(data) {
              cancelled = true;
              if (origCancel) {
                origCancel(data);
                origCancel = undefined;
              }
              done(key, data);
            }
          } else
            unusedKeys.push(key);
        }
      });

      if (unusedKeys.length) {
        var genCancel: VCancel;
        var cancel: Cancel<{[index:string]:V}>;
        unusedKeys.forEach(function(key) {
          const queue: GeneratorQueue<V> = [] as any;
          queue.cancel = function(data) {
            if (cancelledKeys.indexOf(key) === -1)
              cancelledKeys.push(key);
            done(key, data);
          };
          generateQueue[key] = queues[key] = queue;
        });
        if (unusedKeys.length == keys.length) {
          const overrides = {};
          var finish = function(err, ret?) {
            if (finished)
              return;
            if(!ret)
              ret = {};
            Object.keys(overrides).forEach(function(key) {
              const val = overrides[key];
              if(val instanceof Error)
                err = val;
              else if(val)
                ret[key] = val;
            });
            writeUnusedKeys(ret, err);
            if (err)
              callback(err);
            else
              callback(undefined, ret);
            finished = true;
          };
          done = function(key, data) {
            if (data)
              overrides[key] = data;
            if (Object.keys(overrides).length == keys.length) {
              if(finished)
                return;
              finished = true;
              var err = findError(overrides);
              writeUnusedKeys(overrides, err);
              if (err)
                callback(err);
              else
                callback(undefined, overrides);
              if (genCancel)
                genCancel();
            }
          }
          genCancel = generator(keys, finish) as VCancel;
          return function(data) {
            if (finished)
              return;
            var err = data instanceof Error ? data : findError(data);
            if (err)
              finish(err);
            else
              finish(undefined, data);
          };
        } else {
          genCancel = generator(keys, function(err, ret) {
            unusedKeys.forEach(function(key) {
              if (cancelledKeys.indexOf(key) === -1)
                done(key, err || (ret && ret[key]));
            });
          }) as VCancel;
          cancel = function(data) {
            const isError = data instanceof Error;
            unusedKeys.forEach(function(key) {
              if (cancelledKeys.indexOf(key) > -1)
                return;
              done(key, isError ? data : data[key]);
            });
            if (genCancel)
              genCancel();
          }
        }
        return function(data) {
          if(finished)
            return;
          const isError = data instanceof Error;
          Object.keys(keyCancels).forEach(function(key) {
            keyCancels[key](isError ? data : data[key]);
          });
          cancel(data);
          finished = true;
        }
      }
      return function(data) {
        if(finished)
          return;
        const isError = data instanceof Error;
        Object.keys(keyCancels).forEach(function(key) {
          keyCancels[key](isError ? data : data[key]);
        });
        finished = true;
      }
    }
    callback(undefined, {});
    return noop;
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
