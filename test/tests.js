"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support").install();
const assert = require("assert");
const async = require("async");
const path = require("path");
const fs = require("fs");
const LRU = require("../index");
const gccache = new LRU;
const onemb = new Int8Array(1000000);
const datadir = path.resolve(__dirname, "data");
it("large items", function () {
    gccache.set("1mb", onemb);
    gccache.set("5mb", new Int8Array(5000000));
    gccache.set("25mb", new Int8Array(25000000));
    assert.equal(gccache.get("1mb"), onemb);
});
it("capacity", function () {
    const refs = [];
    const cache = new LRU({ capacity: 5 });
    for (var i = 0; i < 10; i++) {
        const obj = new Object;
        cache.set("item" + i, obj);
        refs.push(obj);
    }
    assert.equal(cache.size, 5);
});
it("timeout", function (cb) {
    const refs = [];
    const cache = new LRU({ maxAge: 500 });
    for (var i = 0; i < 10; i++) {
        const obj = new Object;
        cache.set("item" + i, obj);
        refs.push(obj);
    }
    assert.equal(cache.size, 10);
    setTimeout(function () {
        assert.equal(cache.size, 0);
        cb();
    }, 550);
});
const generate_tests = [
    ["a", "a", "b", "b", "c", "c", "d", "d", "a", "b", "c", "d"],
    [["a", "b", "c", "d"], "a", "b", "c", "d"],
    ["a", "d", ["a", "b", "c", "d"], "b", "c"],
    ["e", "f", "a", "e", "f"],
    ["g", "h", ["i", "j", "g"], ["k", "l", "m", "e", "f"]],
    [["k", "l", "m", "e", "f"]]
];
var generate_i = 1;
const realdata = {
    a: Buffer.from("Sudo\r\n"),
    b: Buffer.from("Su\r\n"),
    c: Buffer.from("Cow\r\n"),
    d: Buffer.from("Bash\r\n")
};
const cache = new LRU();
const fslookup = function (key, callback) {
    fs.readFile(path.resolve(datadir, key), function (err, data) {
        callback(key > "f" ? err : undefined, data);
    });
};
const fsmulti = function (keys, callback) {
    const ret = {};
    async.each(keys, function (key, cb) {
        fslookup(key, function (err, _ret) {
            if (key > "f")
                return cb(err);
            else
                ret[key] = _ret;
            cb();
        });
    }, function (err) {
        callback(err, ret);
    });
};
generate_tests.forEach(function (test) {
    const i = generate_i;
    generate_i++;
    const captured = {};
    const dotest = function (cb) {
        async.each(test, function (part, cb) {
            if (Array.isArray(part)) {
                cache.generateMulti(part, fsmulti, function (err, data) {
                    if (i >= 5) {
                        if (!err)
                            throw new Error("Expected error past iteration 5..." + JSON.stringify(part));
                        cb();
                        return;
                    }
                    if (err)
                        cb(err);
                    else {
                        part.forEach(function (p) {
                            const dat = data[p];
                            const cap = captured[p];
                            if (cap)
                                assert.strictEqual(dat, cap);
                            else
                                captured[p] = dat;
                            assert.deepEqual(dat, realdata[p]);
                        });
                        cb();
                    }
                });
            }
            else
                cache.generate(part, fslookup, function (err, data) {
                    if (i >= 5) {
                        if (!err)
                            throw new Error("Expected error past iteration 5... " + part);
                        cb();
                        return;
                    }
                    if (err)
                        cb(err);
                    else {
                        assert.deepEqual(data, realdata[part]);
                        cb();
                    }
                });
        }, cb);
    };
    it("generate " + i, function (cb) {
        cache.clear();
        dotest(cb);
    });
    it("generate " + i + " redo", dotest);
    it("generate " + i + " preset", function (cb) {
        cache.clear();
        Object.keys(captured).forEach(function (key) {
            cache.set(key, captured[key]);
        });
        dotest(cb);
    });
    it("generate " + i + " redo again", dotest);
});
it("iterators", function () {
    const val = new Object;
    const cache = new LRU;
    cache.set("item", val);
    cache.forEach(function (v, key) {
        assert.equal(v, val);
        assert.equal(key, "item");
    });
    const vit = cache.values();
    assert.equal(vit.next().value, val);
    assert.equal(vit.next().done, true);
    const eit = cache.entries();
    assert.equal(eit.next().value[1], val);
    assert.equal(eit.next().done, true);
});
it("lifetime", function (cb) {
    const refs = [];
    const cache = new LRU({ maxAge: 500, minAge: 400, resetTimersOnAccess: true });
    for (var i = 0; i < 10; i++) {
        const obj = new Int8Array(100000);
        cache.set("item" + i, obj);
        refs.push(obj);
    }
    assert.equal(cache.size, 10);
    setTimeout(function () {
        assert.equal(cache.size, 10);
    }, 350);
    assert.equal(cache.size, 10);
    setTimeout(function () {
        for (var i = 0; i < 10; i++) {
            cache.get("item" + i);
        }
        setTimeout(function () {
            assert.equal(cache.size, 10);
        }, 200);
        setTimeout(function () {
            assert.equal(cache.size, 0);
            cb();
        }, 550);
    }, 450);
});
it("gc", function (cb) {
    assert.equal(gccache.get("1mb"), onemb);
    if (gccache.size < 3)
        cb();
    else
        setTimeout(function () {
            if (gccache.size >= 3)
                console.warn("31mb of data was not cleared during this run, weak references may not be working");
            cb();
        }, 1900);
});
//# sourceMappingURL=tests.js.map