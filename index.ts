/// <reference types="node" />

import weak = require("weak");

export = class LRUWeakCache<V extends object> extends Map<string, V> {
  private accesses: {[index: string]: number};
  private timeouts: {[index: string]: number};
  private weakeners: {[index: string]: number};
  private destructors: {[index: string]: () => void} = {};
  private generateQueue: {[index: string]: ((err: Error, value?: V) => void)[]} = {};
  private retimeOnAccess: boolean;
  private reliveOnAccess: boolean;
  private lifetime: number;
  private capacity: number;
  private timeout: number;

  constructor(options: number | {timeout?:number,capacity?:number,lifetime?:number,retimeOnAccess?:boolean,reliveOnAccess?:boolean} = 200) {
    super();
    if(typeof options === "number")
      options = {capacity:options};
    this.reliveOnAccess = options.reliveOnAccess;
    this.retimeOnAccess = options.retimeOnAccess;
    this.lifetime = options.lifetime;
    this.capacity = options.capacity;
    this.timeout = options.timeout;
    if(this.lifetime > 0)
      this.weakeners = {};
    if(this.timeout > 0)
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
      timeouts[key] = setTimeout(destructor, this.timeout) as any;
    }
    try {
      this.accesses[key] = +new Date;
    } catch(e) {}
    try {
      const weakeners = this.weakeners;
      try {clearTimeout(weakeners[key]);} catch(e) {}
      weakeners[key] = setTimeout(function() {
        Map.prototype.set.call(self, key, weak(value, destructor) as any);
      }, this.lifetime) as any;
      return super.set(key, value);
    } catch(e) {
      return super.set(key, weak(value, destructor) as any);
    }
	}
  get(key: string): V{
    var val = super.get(key);
    if(val) {
      if(this.retimeOnAccess)
        try {
          const timeouts = this.timeouts;
          clearTimeout(timeouts[key]);
          timeouts[key] = setTimeout(this.destructors[key], this.timeout) as any;
        } catch(e) {}
      if(this.reliveOnAccess)
        try {
          const self = this;
          const weakeners = this.weakeners;
          try {super.set(key, val = weak.get(val));} catch(e) {}
          clearTimeout(weakeners[key]);
          weakeners[key] = setTimeout(function() {
            Map.prototype.set.call(self, key, weak(val, self.destructors[key]) as any);
          }, this.lifetime) as any;
        } catch(e) {}
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
  generate(key: string, generator: (key: string, callback: (err: Error, value?: V) => void) => void, callback: (err: Error, value?: V) => void) {
    const val = this.get(key);
    if(val === undefined) {
      const generateQueue = this.generateQueue;
      var keyQueue = this.generateQueue[key];
      if(keyQueue)
        keyQueue.push(callback);
      else {
        const self = this;
        keyQueue = this.generateQueue[key] = [callback];
        generator(key, function(err, value) {
          delete self.generateQueue[key];
          if (err)
            keyQueue.forEach(function(callback) {
              callback(err);
            });
          else {
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
