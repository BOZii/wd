var Args = require('vargs').Constructor,
    _ = require('./lodash'),
    Q = require('q'),
    fs = require('fs'),
    path = require('path'),
    url = require('url'),
    JSONWIRE_ERRORS = require('./jsonwire-errors.js');

var varargs = exports.varargs = function (args) {
  var vargs = new(Args)(args);
  // returning undefined instead of empty callback
  vargs.callback = vargs.callbackGiven() ? vargs.callback : undefined;
  return vargs;
};

// small helper to make sure we don't loose exceptions
// use this instead of looking  the last argument manually
exports.findCallback = function (_arguments) {
  var vargs = varargs(_arguments);
  return vargs.callback;
};

// convert to type to something like ById, ByCssSelector, etc...
exports.elFuncSuffix = function (type) {
  var res = (' by ' + type).replace(/(\s[a-z])/g,
    function ($1) {return $1.toUpperCase().replace(' ', ''); });
  return res.replace('Xpath', 'XPath');
};

// return correct jsonwire type
exports.elFuncFullType = function (type) {
  if (type === 'css') {return 'css selector'; } // shortcut for css
  return type;
};

// from JsonWire spec + shortcuts
exports.elementFuncTypes = ['class name', 'css selector', 'id', 'name',
  'link text', 'partial link text', 'tag name', 'xpath', 'css'];

// chai-as-promised promisifier
// just adding the core method for the sake of safety.\
// if you need more than that, build your custom promisifier
var Q_CORE_METHODS = [
  // core methods:
  'then', 'catch', 'fail', 'progress', 'finally', 'fin', 'done',
  'thenResolve', 'thenReject', 'nodeify'
];

exports.transferPromiseness = function (target, promise) {
  _(Q_CORE_METHODS).each(function (methodName) {
    if (promise[methodName]) {
      target[methodName] = promise[methodName].bind(promise);
    }
  });
  if (promise._enrich) {
    promise._enrich(target);
  }
};

// promise detection
exports.isPromise = function (x) {
  return (typeof x === 'object' || typeof x === 'function') && x !== null &&
    typeof x.then === 'function';
};

exports.deprecator = {
  deprecationMessageShown: {},
  warnDeprecated: true,
  showHideDeprecation: function (status) {
    if (status !== undefined) { this.warnDeprecated = status; }
    else { this.warnDeprecated = !this.warnDeprecated; }
  },
  warn: function (cat, message) {
    if (this.warnDeprecated && !this.deprecationMessageShown[cat]) {
      this.deprecationMessageShown[cat] = 1;
      console.warn(message);
    }
  }
};

// Android doesn't like cariage return
exports.inlineJs = function (script) {
  return script.replace(/[\r\n]/g, '').trim();
};

exports.resolveUrl = function (from, to) {
  if (typeof from === 'object') { from = url.format(from); }

  // making sure the last part of the path doesn't get stripped
  if (!from.match(/\/$/)) { from += '/'; }

  return url.parse(url.resolve(from, to));
};

exports.strip = function strip(str) {
  if (typeof(str) !== 'string') { return str; }
  var x = [];
  _(str.length).times(function (i) {
    if (str.charCodeAt(i)) {
      x.push(str.charAt(i));
    }
  });
  return x.join('');
};

var trimToLength = function (str, length) {
  return (str && str.length > length) ? str.substring(0, length) + '...' : str;
};
exports.trimToLength = trimToLength;

exports.niceArgs = function (args) {
  args = args || [];
  return JSON.stringify(args)
    .replace(/^\[/, '(')
    .replace(/\]$/, ')');
};

// convert code to string before execution
exports.codeToString = function (code) {
  if (typeof code === 'function') {
    code = 'return (' + code + ').apply(null, arguments);';
  }
  return code;
};

var MAX_ERROR_LENGTH = 500;
exports.newError = function (opts)
{
  var err = new Error();
  _.each(opts, function (opt, k) {
    err[k] = opt;
  });
  // nicer error output
  err.inspect = function () {
    var jsonStr = JSON.stringify(err);
    return trimToLength(jsonStr, MAX_ERROR_LENGTH);
  };
  return err;
};

exports.isWebDriverException = function (res) {
  return res &&
         res.class &&
         (res.class.indexOf('WebDriverException') > 0);
};

exports.getJsonwireError = function (status) {
  var jsonwireError = JSONWIRE_ERRORS.filter(function (err) {
    return err.status === status;
  });
  return ((jsonwireError.length > 0) ? jsonwireError[0] : null);
};

exports.fileToBase64String = function (filepath) {
  var archiver = require('archiver');
  var deferred = Q.defer();
  var archive = archiver('zip');
  var dataList = [];

  archive
  .on('error', function (err) {
    deferred.reject(err);
  })
  .on('data', function (data) {
    dataList.push(data);
  })
  .on('end', function () {
    var base64Data = Buffer.concat(dataList).toString('base64');
    deferred.resolve(base64Data);
  });

  archive
  .append(
    fs.createReadStream(filepath),
    { name: path.basename(filepath) }
  );

  archive.finalize(function (err) {
    if (err) { deferred.reject(err); }
  });
  return deferred.promise;
};
