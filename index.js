"use strict";
const weak = require("weak-napi");
const findError = function (data) {
    var err;
    Object.keys(data).forEach(function (key) {
        const val = data[key];
        if (val instanceof Error) {
            if (err) {
                if (err.message !== val.message) {
                    if (!err['multi']) {
                        console.warn(err);
                        err = new Error("Multiple errors occured, see log");
                        err['multi'] = true;
                    }
                    console.warn(val);
                }
            }
            else
                err = val;
        }
    });
    return err;
};
const noop = function () { };
module.exports = class LRUWeakCache extends Map {
    constructor(options = 200) {
        super();
        this.destructors = {};
        this.generateQueue = {};
        if (typeof options === "number")
            options = { capacity: options };
        this.resetTimersOnAccess = options.resetTimersOnAccess;
        this.capacity = options.capacity;
        this.minAge = options.minAge;
        this.maxAge = options.maxAge;
        if (this.minAge > 0)
            this.weakeners = {};
        if (this.maxAge > 0)
            this.timeouts = {};
        if (this.capacity > 0)
            this.accesses = {};
    }
    clear() {
        this.destructors = {};
        const generateQueue = this.generateQueue;
        Object.keys(generateQueue).forEach(function (key) {
            generateQueue[key].cancel();
        });
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
            const weakeners = this.weakeners;
            Object.keys(weakeners).forEach(function (key) {
                try {
                    clearTimeout(weakeners[key]);
                }
                catch (e) { }
            });
            this.weakeners = {};
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
        const queue = this.generateQueue[key];
        if (queue)
            queue.cancel();
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
    trim(by) {
        const accesses = this.accesses;
        const keys = Array.from(this.keys());
        keys.sort(function (a, b) {
            return accesses[a] - accesses[b];
        });
        for (var i = 0; i < by; i++)
            this.delete(keys[i]);
        return this;
    }
    setMulti(data) {
        const self = this;
        const toset = {};
        Object.keys(data).forEach(function (key) {
            const val = data[key];
            if (val && val !== Map.prototype.get.call(self, key))
                toset[key] = val;
            else
                self.delete(key);
        });
        const keys = Object.keys(toset);
        const length = keys.length;
        if (length) {
            const capacity = this.capacity;
            const over = (this.size - this.capacity) + length;
            if (over > 0)
                this.trim(over);
            const accesses = this.accesses;
            const timeouts = this.timeouts;
            const weakeners = this.weakeners;
            const generateQueue = this.generateQueue;
            const set = Map.prototype.set;
            keys.forEach(function (key) {
                const value = toset[key];
                const queue = generateQueue[key];
                if (queue)
                    queue.cancel(value);
                const destructor = self.makeDestruct(key);
                self.destructors[key] = destructor;
                if (timeouts) {
                    try {
                        clearTimeout(timeouts[key]);
                    }
                    catch (e) { }
                    timeouts[key] = setTimeout(destructor, self.maxAge);
                }
                try {
                    accesses[key] = +new Date;
                }
                catch (e) { }
                try {
                    try {
                        clearTimeout(weakeners[key]);
                    }
                    catch (e) { }
                    weakeners[key] = setTimeout(function () {
                        set.call(self, key, weak(value, destructor));
                    }, self.minAge);
                    set.call(self, key, value);
                }
                catch (e) {
                    set.call(self, key, weak(value, destructor));
                }
            });
        }
        return this;
    }
    set(key, value) {
        var cvalue = super.get(key);
        try {
            cvalue = weak.get(cvalue);
        }
        catch (e) { }
        if (cvalue === value)
            return;
        const capacity = this.capacity;
        const over = (this.size - this.capacity) + 1;
        if (over > 0)
            this.trim(over);
        const generateQueue = this.generateQueue;
        const queue = generateQueue[key];
        if (queue)
            queue.cancel(value);
        const self = this;
        const destructor = this.makeDestruct(key);
        this.destructors[key] = destructor;
        const timeouts = this.timeouts;
        if (timeouts) {
            try {
                clearTimeout(timeouts[key]);
            }
            catch (e) { }
            timeouts[key] = setTimeout(destructor, this.maxAge);
        }
        try {
            this.accesses[key] = +new Date;
        }
        catch (e) { }
        try {
            const weakeners = this.weakeners;
            try {
                clearTimeout(weakeners[key]);
            }
            catch (e) { }
            weakeners[key] = setTimeout(function () {
                Map.prototype.set.call(self, key, weak(value, destructor));
            }, this.minAge);
            return super.set(key, value);
        }
        catch (e) {
            return super.set(key, weak(value, destructor));
        }
    }
    get(key) {
        var val = super.get(key);
        if (val) {
            if (this.resetTimersOnAccess) {
                try {
                    const timeouts = this.timeouts;
                    clearTimeout(timeouts[key]);
                    timeouts[key] = setTimeout(this.destructors[key], this.maxAge);
                }
                catch (e) { }
                try {
                    const self = this;
                    const weakeners = this.weakeners;
                    try {
                        super.set(key, val = weak.get(val));
                    }
                    catch (e) { }
                    clearTimeout(weakeners[key]);
                    weakeners[key] = setTimeout(function () {
                        Map.prototype.set.call(self, key, weak(val, self.destructors[key]));
                    }, this.minAge);
                }
                catch (e) { }
            }
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
            var keyQueue = generateQueue[key];
            if (keyQueue)
                keyQueue.push(callback);
            else {
                const self = this;
                var finished;
                const finish = function (err, value) {
                    if (finished)
                        return;
                    finished = true;
                    if (generateQueue[key] === keyQueue)
                        delete generateQueue[key];
                    if (err)
                        keyQueue.forEach(function (callback) {
                            callback(err);
                        });
                    else {
                        if (value && !generateQueue[key])
                            self.set(key, value);
                        keyQueue.forEach(function (callback) {
                            callback(undefined, value);
                        });
                    }
                };
                var retCancel;
                keyQueue = generateQueue[key] = [callback];
                keyQueue.cancel = function (data) {
                    if (data instanceof Error)
                        finish(data);
                    else
                        finish(undefined, data);
                    if (retCancel)
                        retCancel();
                };
                retCancel = generator(key, finish);
            }
            return keyQueue.cancel;
        }
        callback(undefined, val);
        return noop;
    }
    generateMulti(keys, generator, callback) {
        if (keys.length) {
            const self = this;
            const unusedKeys = [];
            var finished;
            var remaining = keys.length;
            const cancelledKeys = [];
            const ret = {};
            const retKeys = {};
            const keyCancels = {};
            const queues = {};
            const writeUnusedKeys = function (ret, err) {
                if (err)
                    keys.forEach(function (key) {
                        const queue = queues[key];
                        if (queue === generateQueue[key])
                            delete generateQueue[key];
                        if (queue)
                            queue.forEach(function (cb) {
                                cb(err);
                            });
                    });
                else {
                    const toset = {};
                    keys.forEach(function (key) {
                        const queue = queues[key];
                        if (queue === generateQueue[key])
                            delete generateQueue[key];
                        const value = ret[key];
                        if (value && !generateQueue[key])
                            toset[key] = value;
                        if (queue)
                            queue.forEach(function (cb) {
                                cb(undefined, value);
                            });
                    });
                    self.setMulti(toset);
                }
            };
            var done = function (key, val) {
                if (finished)
                    return;
                if (val)
                    ret[key] = val;
                if (retKeys[key])
                    return;
                retKeys[key] = true;
                if (!--remaining) {
                    finished = true;
                    var err = findError(ret);
                    writeUnusedKeys(ret, err);
                    if (err)
                        callback(err);
                    else
                        callback(undefined, ret);
                }
            };
            const generateQueue = this.generateQueue;
            keys.forEach(function (key) {
                const val = self.get(key);
                if (val)
                    done(key, val);
                else {
                    const keyQueue = generateQueue[key];
                    if (keyQueue) {
                        var cancelled;
                        var origCancel = keyQueue.cancel;
                        (queues[key] = (generateQueue[key] = keyQueue.splice(0, keyQueue.length, function (err, value) {
                            if (!cancelled)
                                done(key, err || value);
                        }))).cancel = keyCancels[key] = function (data) {
                            cancelled = true;
                            if (origCancel) {
                                origCancel(data);
                                origCancel = undefined;
                            }
                            done(key, data);
                        };
                    }
                    else
                        unusedKeys.push(key);
                }
            });
            if (unusedKeys.length) {
                var genCancel;
                var cancel;
                unusedKeys.forEach(function (key) {
                    const queue = [];
                    queue.cancel = function (data) {
                        if (cancelledKeys.indexOf(key) === -1)
                            cancelledKeys.push(key);
                        done(key, data);
                    };
                    generateQueue[key] = queues[key] = queue;
                });
                if (unusedKeys.length == keys.length) {
                    const overrides = {};
                    var finish = function (err, ret) {
                        if (finished)
                            return;
                        if (!ret)
                            ret = {};
                        Object.keys(overrides).forEach(function (key) {
                            const val = overrides[key];
                            if (val instanceof Error)
                                err = val;
                            else if (val)
                                ret[key] = val;
                        });
                        writeUnusedKeys(ret, err);
                        if (err)
                            callback(err);
                        else
                            callback(undefined, ret);
                        finished = true;
                    };
                    done = function (key, data) {
                        if (data)
                            overrides[key] = data;
                        if (Object.keys(overrides).length == keys.length) {
                            if (finished)
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
                    };
                    genCancel = generator(keys, finish);
                    return function (data) {
                        if (finished)
                            return;
                        var err = data instanceof Error ? data : findError(data);
                        if (err)
                            finish(err);
                        else
                            finish(undefined, data);
                    };
                }
                else {
                    genCancel = generator(keys, function (err, ret) {
                        unusedKeys.forEach(function (key) {
                            if (cancelledKeys.indexOf(key) === -1)
                                done(key, err || (ret && ret[key]));
                        });
                    });
                    cancel = function (data) {
                        const isError = data instanceof Error;
                        unusedKeys.forEach(function (key) {
                            if (cancelledKeys.indexOf(key) > -1)
                                return;
                            done(key, isError ? data : data[key]);
                        });
                        if (genCancel)
                            genCancel();
                    };
                }
                return function (data) {
                    if (finished)
                        return;
                    const isError = data instanceof Error;
                    Object.keys(keyCancels).forEach(function (key) {
                        keyCancels[key](isError ? data : data[key]);
                    });
                    cancel(data);
                    finished = true;
                };
            }
            return function (data) {
                if (finished)
                    return;
                const isError = data instanceof Error;
                Object.keys(keyCancels).forEach(function (key) {
                    keyCancels[key](isError ? data : data[key]);
                });
                finished = true;
            };
        }
        callback(undefined, {});
        return noop;
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