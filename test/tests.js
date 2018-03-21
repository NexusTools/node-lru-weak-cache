"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support").install();
const assert = require("assert");
const LRU = require("../index");
const gccache = new LRU;
const onemb = new Int8Array(1000000);
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
    const cache = new LRU({ timeout: 500 });
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
it("generate", function (cb) {
    var first;
    const cache = new LRU();
    const generator = function (key, cb) {
        setTimeout(function () {
            const val = { a: Math.random(), b: Math.random(), c: Math.random() };
            if (!first)
                first = val;
            cb(undefined, val);
        }, Math.random() * 1500);
    };
    var remaining = 200;
    for (var i = 0; i < 200; i++) {
        cache.generate("test", generator, function (err, res) {
            assert.equal(res, first);
            if (!--remaining) {
                cache.generate("test", undefined, function (err, value) {
                    assert.equal(value, first);
                    cache.clear();
                    assert.equal(cache.size, 0);
                    cache.generate("test", function (key, cb) {
                        cb(new Error("Test"));
                    }, function (err) {
                        assert.equal(err.message, "Test");
                        cb();
                    });
                });
            }
        });
    }
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
    const cache = new LRU({ timeout: 500, lifetime: 400, reliveOnAccess: true, retimeOnAccess: true });
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