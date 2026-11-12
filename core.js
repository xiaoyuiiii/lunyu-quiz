/* 纯逻辑层：不依赖 DOM，便于单元测试（node core.test.js） */
(function (root) {
  'use strict';

  var keyOf = function (arr) {
    return (arr || []).slice().sort().join('');
  };

  function isCorrect(item, picked) {
    if (!item || !picked || !picked.length) return false;
    return keyOf(item.a) === keyOf(picked);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function filterItems(items, opt) {
    opt = opt || {};
    var types = opt.types && opt.types !== 'all' ? opt.types : null;
    var from = opt.from ? Number(opt.from) : null;
    var to = opt.to ? Number(opt.to) : null;
    return items.filter(function (it) {
      if (types && it.t !== types) return false;
      if (from && it.n < from) return false;
      if (to && it.n > to) return false;
      return true;
    });
  }

  /**
   * @param mode order|shuffle|wrong|star|todo
   */
  function buildQueue(items, mode, ctx) {
    ctx = ctx || {};
    var records = ctx.records || {};
    var stars = ctx.stars || [];
    var base = filterItems(items, ctx);

    if (mode === 'wrong') {
      base = base.filter(function (it) {
        var r = records[it.n];
        return r && r.last === 'wrong';
      });
    } else if (mode === 'star') {
      base = base.filter(function (it) { return stars.indexOf(it.n) >= 0; });
    } else if (mode === 'todo') {
      base = base.filter(function (it) { return !records[it.n]; });
    }

    base = base.slice().sort(function (a, b) { return a.n - b.n; });
    if (mode === 'shuffle') base = shuffle(base);
    return base;
  }

  function stats(items, records, stars) {
    records = records || {};
    var total = items.length;
    var seen = 0, mastered = 0, wrong = 0;
    items.forEach(function (it) {
      var r = records[it.n];
      if (!r) return;
      seen++;
      if (r.last === 'right') mastered++; else wrong++;
    });
    return {
      total: total,
      seen: seen,
      todo: total - seen,
      mastered: mastered,
      wrong: wrong,
      accuracy: seen ? Math.round((mastered / seen) * 100) : 0,
      stars: (stars || []).length
    };
  }

  function answerLabel(item) {
    return (item.a || []).join('');
  }

  var api = {
    isCorrect: isCorrect,
    keyOf: keyOf,
    shuffle: shuffle,
    filterItems: filterItems,
    buildQueue: buildQueue,
    stats: stats,
    answerLabel: answerLabel
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QuizCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
