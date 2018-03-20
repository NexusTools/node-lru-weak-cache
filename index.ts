/// <reference types="node" />

import weak = require("weak");

export = class LRUWeakCache<V extends object> extends Map<string, V> {
  private accesses: {[index: string]: number};
  private timeouts: {[index: string]: number};
  private destructors: {[index: string]: Function} = {};
  private generateQueue: {[index: string]: ((err: Error, value?: V) => void)[]} = {};
  private retimeOnAccess: boolean;
  private capacity: number;
  private timeout: number;

  constructor(options: {timeout?: number,capacity?: number,retimeOnAccess?:boolean} = {}) {
    super();
    this.retimeOnAccess = options.retimeOnAccess;
    this.capacity = options.capacity;
    this.timeout = options.timeout;
    if(this.timeout) {
      if(this.timeout < 0)
        throw new Error("timeout cannot be negative");
      this.timeouts = {};
    }
    if(this.capacity) {
      if(this.capacity < 0)
        throw new Error("capacity cannot be negative");
      this.accesses = {};
    }
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
    value = weak(value, destructor) as any;
    const timeouts = this.timeouts;
    if(timeouts) {
      try {clearTimeout(timeouts[key]);} catch(e) {}
      timeouts[key] = setTimeout(destructor, this.timeout) as any;
    }
    try {
      this.accesses[key] = +new Date;
    } catch(e) {}
    return super.set(key, value);
	}
  get(key: string): V{
    const val = super.get(key);
    if(this.retimeOnAccess)
      try {
        const timeouts = this.timeouts;
        clearTimeout(timeouts[key]);
        timeouts[key] = setTimeout(this.destructors[key], this.timeout);
      } catch(e) {}
    try {
      this.accesses[key] = +new Date;
    } catch(e) {}
    return val;
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
}
