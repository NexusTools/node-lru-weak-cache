"use strict";
const weak = require("weak");
module.exports = class LRUWeakCache extends Map {
    constructor(options = {}) {
        super();
        this.destructors = {};
        this.generateQueue = {};
        this.retimeOnAccess = options.retimeOnAccess;
        this.capacity = options.capacity;
        this.timeout = options.timeout;
        if (this.timeout) {
            if (this.timeout < 0)
                throw new Error("timeout cannot be negative");
            this.timeouts = {};
        }
        if (this.capacity) {
            if (this.capacity < 0)
                throw new Error("capacity cannot be negative");
            this.accesses = {};
        }
    }
    clear() {
        this.destructors = {};
        try {
            const timeouts = this.timeouts;
            Object.keys(timeouts).forEach(function (key) {
                try {
                    clearTimeout(timeouts[key]);
                }
                catch (e) { }
            });
            this.timeouts = {};
        }
        catch (e) { }
        try {
            this.accesses = {};
        }
        catch (e) { }
        super.clear();
    }
    delete(key) {
        delete this.destructors[key];
        try {
            const timeouts = this.timeouts;
            clearTimeout(timeouts[key]);
            delete timeouts[key];
        }
        catch (e) { }
        try {
            delete this.accesses[key];
        }
        catch (e) { }
        return super.delete(key);
    }
    makeDestruct(key) {
        const self = this;
        const destructor = function () {
            if (self.destructors[key] === destructor)
                self.delete(key);
        };
        return destructor;
    }
    set(key, value) {
        const capacity = this.capacity;
        const over = (this.size - this.capacity) + 1;
        if (over > 0) {
            const accesses = this.accesses;
            const keys = Array.from(this.keys());
            keys.sort(function (a, b) {
                return accesses[a] - accesses[b];
            });
            for (var i = 0; i < over; i++)
                this.delete(keys[i]);
        }
        const self = this;
        const destructor = this.makeDestruct(key);
        this.destructors[key] = destructor;
        const timeouts = this.timeouts;
        if (timeouts) {
            try {
                clearTimeout(timeouts[key]);
            }
            catch (e) { }
            timeouts[key] = setTimeout(destructor, this.timeout);
        }
        try {
            this.accesses[key] = +new Date;
        }
        catch (e) { }
        return super.set(key, weak(value, destructor));
    }
    get(key) {
        const val = super.get(key);
        if (val) {
            if (this.retimeOnAccess)
                try {
                    const timeouts = this.timeouts;
                    clearTimeout(timeouts[key]);
                    timeouts[key] = setTimeout(this.destructors[key], this.timeout);
                }
                catch (e) { }
            try {
                this.accesses[key] = +new Date;
            }
            catch (e) { }
            try {
                return weak.get(val);
            }
            catch (e) { }
        }
        return val;
    }
    forEach(callbackfn, thisArg) {
        super.forEach(function (value, key, map) {
            try {
                value = weak.get(value);
            }
            catch (e) { }
            callbackfn.call(this, value, key, map);
        }, thisArg);
    }
    generate(key, generator, callback) {
        const val = this.get(key);
        if (val === undefined) {
            const generateQueue = this.generateQueue;
            var keyQueue = this.generateQueue[key];
            if (keyQueue)
                keyQueue.push(callback);
            else {
                const self = this;
                keyQueue = this.generateQueue[key] = [callback];
                generator(key, function (err, value) {
                    delete self.generateQueue[key];
                    if (err)
                        keyQueue.forEach(function (callback) {
                            callback(err);
                        });
                    else {
                        self.set(key, value);
                        keyQueue.forEach(function (callback) {
                            callback(undefined, value);
                        });
                    }
                });
            }
        }
        else
            callback(undefined, val);
    }
    entries() {
        const it = super.entries();
        const next = it.next;
        it.next = function () {
            const n = next.apply(it, arguments);
            try {
                n.value[1] = weak.get(n.value[1]);
            }
            catch (e) { }
            return n;
        };
        return it;
    }
    values() {
        const it = super.values();
        const next = it.next;
        it.next = function () {
            const n = next.apply(it, arguments);
            try {
                n.value = weak.get(n.value);
            }
            catch (e) { }
            return n;
        };
        return it;
    }
};
//# sourceMappingURL=index.js.map