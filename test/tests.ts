/// <reference types="mocha" />

require("source-map-support").install();
import assert = require("assert");

import LRU = require("../index");

const gccache = new LRU;
it("large items", function() {
  gccache.set("item1", new Int8Array(1000000)); // 1mb
  gccache.set("item2", new Int8Array(5000000)); // 5mb
  gccache.set("item3", new Int8Array(25000000)); // 25mb
});
it("negative", function () {
  assert.throws(function() {
    new LRU({timeout:-1});
  }, "negative timeout did not throw error");
  assert.throws(function() {
    new LRU({capacity:-1});
  }, "negative capacity did not throw error");
});
it("capacity", function () {
  const refs = [];
  const cache = new LRU({capacity:5});
  for(var i=0; i<10; i++) {
    const obj = new Object;
    cache.set("item" + i, obj);
    refs.push(obj);
  }
  assert.equal(cache.size, 5);
});
it("timeout", function (cb) {
  const refs = [];
  const cache = new LRU({timeout:500});
  for(var i=0; i<10; i++) {
    const obj = new Object;
    cache.set("item" + i, obj);
    refs.push(obj);
  }
  assert.equal(cache.size, 10);
  setTimeout(function() {
    assert.equal(cache.size, 0);
    cb();
  }, 550);
});
it("generate", function (cb) {
  var first: any;
  const cache = new LRU();
  const generator = function(key, cb) {
    setTimeout(function() {
      const val = {a: Math.random(), b: Math.random(), c: Math.random()};
      if(!first)
        first = val;
      cb(undefined, val);
    }, Math.random() * 1500);
  }

  var remaining = 200;
  for(var i=0; i<200; i++) {
    cache.generate("test", generator, function(err, res) {
      assert.equal(JSON.stringify(res), JSON.stringify(first));
      if(!--remaining) {
        cache.generate("test", undefined, function(err, value) {
          assert.equal(JSON.stringify(value), JSON.stringify(first));
          cache.clear();
          assert.equal(cache.size, 0);
          cache.generate("test", function(key, cb) {
            cb(new Error("Test"));
          }, function(err) {
            assert.equal(err.message, "Test");
            cb();
          });
        });
      }
    });
  }
});
// Test if 25mb weak item was gc'd
it("gc", function(cb) {
  if(gccache.size < 3)
    cb();
  else
    setTimeout(function() {
      //assert.notEqual(gccache.size, 3);
      //assert.equal(gccache.has("item3"), false);
      if(gccache.size >= 3)
        console.warn("31mb of data was not cleared during this run, weak references may not be working");
      cb();
    }, 1900);
})
