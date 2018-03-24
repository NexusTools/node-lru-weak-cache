/// <reference types="mocha" />

import assert = require("assert");
import async = require("async");
import weak = require("weak");
import path = require("path");
import util = require("util");
import fs = require("fs");

import LRU = require("../index");

const gccache = new LRU;
const onemb = new Int8Array(1000000);
const datadir = path.resolve(__dirname, "data");
it("large items", function() {
  gccache.set("1mb", onemb); // 1mb
  gccache.set("5mb", new Int8Array(5000000)); // 5mb
  gccache.set("25mb", new Int8Array(25000000)); // 25mb
  assert.equal(gccache.get("1mb"), onemb);
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
  const cache = new LRU({maxAge:500});
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
const generate_tests = [
  ["a", "a", "b", "b", "c", "c", "d", "d", "a", "b", "c", "d"],
  [["a", "b", "c", "d"], "a", "b", "c", "d"],
  ["a", "b", "c", "d", ["a", "b", "c", "d"], "b", "c"],
  ["e", "f", "a", "e", "f"],
  ["g", "h", ["i", "j", "g"], ["k", "l", "m", "e", "f"]],
  [["k", "l", "m", "e", "f"]]
];
const realdata = {
  a: Buffer.from("Sudo\r\n"),
  b: Buffer.from("Su\r\n"),
  c: Buffer.from("Cow\r\n"),
  d: Buffer.from("Bash\r\n")
};
const fslookup = function(key: string, callback: (err?: Error, ret?: Buffer) => void) {
  // console.log("fslookup", key);
  fs.readFile(path.resolve(datadir, key), function(err, data) {
    callback(key > "f" ? err : undefined, data);
  });
}
const fsmulti = function(keys: string[], callback: (err: Error, ret?: {[key: string]: Buffer}) => void) {
  const ret = {};
  async.each(keys, function(key, cb) {
      fslookup(key, function(err, _ret) {
        if(key > "f")
          return cb(err);
        else
          ret[key] = _ret;
        cb();
      });
  }, function(err) {
    callback(err, ret);
  });
}
const doGenerateTests = function(tests: (string[] | string)[][], errorAfter: number, series = false, setInterval?: number, offset = 0) {
  var a = 1;
  tests.forEach(function(test) {
    const i = a ++;
    const captured = {};
    const cache = new LRU<Buffer>({});
    const dotest = function (cb) {
      var setCount = 0;
      var errored: boolean;
      const expectError = i > errorAfter;
      const verify = function(p: string, dat) {
        const cap = captured[p];
        assert.equal(weak.isWeakRef(dat), false, "weak reference snuck through...");
        if(dat) {
          if (cap && dat !== cap)
            console.warn(p + " did not === previously resolved value");
          captured[p] = dat;
        }
        assert.deepEqual(dat, realdata[p], p + " did not match real data, " + util.inspect(dat) + " !== " + util.inspect(realdata[p]));
      };
      (series ? async.eachSeries : async.each)(test, function(part, cb) {
        var returned: string;
        if(Array.isArray(part)) {
          // console.log("generating", part);
          cache.generateMulti(part, fsmulti, function(err, data) {
            // console.log("generated", part);
            if(returned) {
              console.warn(returned);
              throw new Error("Already returned data");
            }
            returned = (new Error).stack.replace(/^Error\n/m, "");

            if(expectError && err) {
              errored = true;
              cb();
              return;
            }

            if(err)
              cb(err);
            else {
              part.forEach(function(p) {
                verify(p, data[p]);
              });
              cb();
            }
          });
          if (setInterval && !((setCount++ + offset) % setInterval))
            part.forEach(function(p) {
              const val = realdata[p];
              if (val)
                cache.set(p, captured[p] = val);
            });
        } else {
          // console.log("generating", part);
          cache.generate(part, fslookup, function(err, data) {
            // console.log("generated", part);
            if(returned) {
              console.warn(returned);
              throw new Error("Already returned data");
            }
            returned = (new Error).stack.replace(/^Error\n/m, "");

            if(expectError && err) {
              errored = true;
              cb();
              return;
            }

            if(err)
              cb(err);
            else {
              verify(part, data);
              cb();
            }
          });
          if (setInterval && !((setCount++ + offset) % setInterval)) {
            const val = realdata[part];
            if (val)
              cache.set(part, captured[part] = val);
          }
        }
      }, function(err?: Error) {
        if(err)
          cb(err);
        else {
          if(expectError && !errored)
            cb(new Error("Expected error past iteration " + errorAfter));
          else
            cb();
        }
      });
    };
    it("generate test #" + i, dotest);
    it("generate test #" + i + " redo", dotest);
    it("generate test #" + i + " preset", function(cb) {
      cache.clear();
      Object.keys(realdata).forEach(function(key) {
        cache.set(key, captured[key] = realdata[key]);
      });
      dotest(cb);
    });
    it("generate test #" + i + " redo again", dotest);
  });
}
const generate_tests_kinda_compact = [];
for(var i=0; i<generate_tests.length; i+= 2) {
  const compact = [];
  compact.push.apply(compact, generate_tests[i]);
  compact.push.apply(compact, generate_tests[i+1]);
  generate_tests_kinda_compact.push(compact);
}
const generate_tests_more_compact = [];
for(var i=0; i<generate_tests.length; i+=3) {
  const compact = [];
  compact.push.apply(compact, generate_tests[i]);
  compact.push.apply(compact, generate_tests[i+1]);
  compact.push.apply(compact, generate_tests[i+2]);
  generate_tests_more_compact.push(compact);
}
[0, 5, 3, 1].forEach(function(interval) {
  describe("Generate Tests, Interval " + interval, function() {
    [0, 2, 4, 6].forEach(function(offset) {
      describe("Series, Offset " + offset, function() {
        doGenerateTests(generate_tests, 4, true, interval, offset);
      });
      describe("Parallel, Offset " + offset, function() {
        doGenerateTests(generate_tests, 4, false, interval, offset);
      });
      describe("Kinda Compact, Series, Offset " + offset, function() {
        doGenerateTests(generate_tests_kinda_compact, 2, true, interval, offset);
      });
      describe("Kinda Compact, Parallel, Offset " + offset, function() {
        doGenerateTests(generate_tests_kinda_compact, 2, false, interval, offset);
      });
      describe("More Compact, Series, Offset " + offset, function() {
        doGenerateTests(generate_tests_more_compact, 1, true, interval, offset);
      });
      describe("More Compact, Parallel, Offset " + offset, function() {
        doGenerateTests(generate_tests_more_compact, 1, false, interval, offset);
      });
    });
  });
});
describe("Final Generator Tests", function() {
  const cache = new LRU<Buffer>();
  const err = new Error("Toasted Wheats");
  const _a = Buffer.from("Mixture");
  const _b = Buffer.from("Farmers");
  it("generate cancel error", function(cb) {
    cache.generate("a", fslookup, function(_err, data) {
      assert.equal(_err, err);
      cb();
    })(err);
  });
  it("generateMulti cancel error", function(cb) {
    cache.generateMulti(["a", "b", "c", "d"], fsmulti, function(_err, data) {
      assert.equal(_err, err);
      cb();
    })(err);
  });
  it("generateMulti cancel", function(cb) {
    const data = {a:_a,b:_b,e:Buffer.from("Ignored")};
    cache.generateMulti(["a", "b", "c", "d"], fsmulti, function(err, _data) {
      assert.deepEqual(_data, data);
      cb(err);
    })(data);
  });
  it("generate to generateMulti cancel error", function(cb) {
    cache.clear();
    var total = 3;
    cache.generate("a", fslookup, function(_err) {
      assert.equal(_err, err);
      if (!--total)
        cb();
    });
    cache.generate("b", fslookup, function(_err) {
      assert.equal(_err, err);
      if (!--total)
        cb();
    });
    cache.generateMulti(["a", "b", "c", "d"], fsmulti, function(_err) {
      assert.equal(_err, err);
      if (!--total)
        cb();
    })(err);
  });
  it("generate to generateMulti cancel", function(cb) {
    var total = 3;
    const a = cache.generate("a", fslookup, function(err, data) {
      if (err)
        cb(err);
      else {
        assert.strictEqual(data, _a);
        if (!--total)
          cb();
      }
    });
    const b = cache.generate("b", fslookup, function(err, data) {
      if (err)
        cb(err);
      else {
        assert.strictEqual(data, _b);
        if (!--total)
          cb();
      }
    });
    const data = {a:_a,b:_b};
    cache.generateMulti(["a", "b", "c", "d"], fsmulti, function(err, _data) {
      if (err)
        cb(err);
      else {
        assert.deepEqual(_data, data);
        if (!--total)
          cb();
      }
    })(data)
  });
  it("generateMulti set", function(cb) {
    cache.clear();
    const empty = new Buffer(0);
    const data = {a:_a,b:_b,c:empty,d:empty};
    cache.generateMulti(["a", "b", "c", "d"], fsmulti, function(err, data) {
      assert.deepEqual(data, data);
      cb(err);
    });
    cache.set("a", _a);
    cache.set("b", _b);
    cache.set("c", empty);
    cache.set("d", empty);
  });
  it("generateMulti generate error", function(cb) {
    cache.clear();
    var total = 2;
    cache.generateMulti(["a", "b", "c", "d"], fsmulti, function(_err, data) {
      assert.equal(_err, err);
      if (!--total)
        cb();
    });
    cache.generate("a", fslookup, function(_err, data) {
      assert.equal(_err, err);
      if (!--total)
        cb();
    })(err);
  });
  it("generate generateMulti cancel error", function(cb) {
    cache.clear();
    var total = 3;
    cache.generate("a", fslookup, function(_err, data) {
      assert.equal(_err, err);
      if (!--total)
        cb();
    });
    cache.generate("b", fslookup, function(_err, data) {
      assert.equal(_err, err);
      if (!--total)
        cb();
    });
    cache.generateMulti(["a", "b"], fsmulti, function(_err, data) {
      assert.equal(_err, err);
      if (!--total)
        cb();
    })(err);
  });
});
describe("Final Stuff", function() {
  it("iterators", function() {
    const val = new Object;
    const cache = new LRU;
    cache.set("item", val);
    cache.forEach(function(v, key) {
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
  it("lifetime", function(cb) {
    const refs = [];
    const cache = new LRU({maxAge:500,minAge:400,resetTimersOnAccess:true});
    for(var i=0; i<10; i++) {
      const obj = new Int8Array(100000);
      cache.set("item" + i, obj);
      refs.push(obj);
    }
    assert.equal(cache.size, 10);
    setTimeout(function() {
      assert.equal(cache.size, 10);
    }, 350);
    assert.equal(cache.size, 10);
    setTimeout(function() {
      for(var i=0; i<10; i++) {
        cache.get("item" + i);
      }
      setTimeout(function() {
        assert.equal(cache.size, 10);
      }, 200);
      setTimeout(function() {
        assert.equal(cache.size, 0);
        cb();
      }, 550);
    }, 450);
  });
  // Test if 25mb weak item was gc'd
  it("gc", function(cb) {
    assert.equal(gccache.get("1mb"), onemb);
    if(gccache.size < 3)
      cb();
    else
      setTimeout(function() {
        if(gccache.size >= 3)
          console.warn("31mb of data was not cleared during this run, weak references may not be working");
        cb();
      }, 1900);
  })
})
