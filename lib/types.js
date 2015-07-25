/*!
 * Nodeunit
 * Copyright (c) 2010 Caolan McMahon
 * MIT Licensed
 *
 * THIS FILE SHOULD BE BROWSER-COMPATIBLE JS!
 * You can use @REMOVE_LINE_FOR_BROWSER to remove code from the browser build.
 * Only code on that line will be removed, it's mostly to avoid requiring code
 * that is node specific
 */

/**
 * Module dependencies
 */

var assert = require('./assert'),     //@REMOVE_LINE_FOR_BROWSER
    async = require('../deps/async'); //@REMOVE_LINE_FOR_BROWSER


/**
 * Creates assertion objects representing the result of an assert call.
 * Accepts an object or AssertionError as its argument.
 *
 * @param {object} obj
 * @api public
 */

exports.assertion = function (obj) {
    return {
        method: obj.method || '',
        message: obj.message || (obj.error && obj.error.message) || '',
        error: obj.error,
        passed: function () {
            return !this.error;
        },
        failed: function () {
            return Boolean(this.error);
        }
    };
};

/**
 * Creates an assertion list object representing a group of assertions.
 * Accepts an array of assertion objects.
 *
 * @param {Array} arr
 * @param {Number} duration
 * @api public
 */

exports.assertionList = function (arr, duration) {
    var that = arr || [];
    that.failures = function () {
        var failures = 0;
        for (var i = 0; i < this.length; i += 1) {
            if (this[i].failed()) {
                failures += 1;
            }
        }
        return failures;
    };
    that.passes = function () {
        return that.length - that.failures();
    };
    that.duration = duration || 0;
    return that;
};

/**
 * Create a wrapper function for assert module methods. Executes a callback
 * after it's complete with an assertion object representing the result.
 *
 * @param {Function} callback
 * @api private
 */

var assertWrapper = function (callback) {
    return function (new_method, assert_method, arity) {
        return function () {
            var message = arguments[arity - 1];
            var a = exports.assertion({method: new_method, message: message});
            try {
                assert[assert_method].apply(null, arguments);
            }
            catch (e) {
                a.error = e;
            }
            callback(a);
        };
    };
};

/**
 * Creates the 'test' object that gets passed to every test function.
 * Accepts the name of the test function as its first argument, followed by
 * the start time in ms, the options object and a callback function.
 *
 * @param {String} name
 * @param {Number} start
 * @param {Object} options
 * @param {Function} callback
 * @api public
 */

exports.test = function (name, start, options, callback) {
    var expecting;
    var expectedCalls = 0;
    var a_list = [];

    var wrapAssert = assertWrapper(function (a) {
        a_list.push(a);
        if (options.log) {
            async.nextTick(function () {
                options.log(a);
            });
        }
    });

    var test = {
        done: function (err) {
            if (expecting !== undefined && expecting !== a_list.length) {
                var e = new Error(
                    'Expected ' + expecting + ' assertions, ' +
                    a_list.length + ' ran'
                );
                var a1 = exports.assertion({method: 'expect', error: e});
                a_list.push(a1);
                if (options.log) {
                    async.nextTick(function () {
                        options.log(a1);
                    });
                }
            }
            if (expectedCalls > 0) {
                var e2 = new Error(
                    'Expected ' + expectedCalls + ' more mock method calls, than actually ran'
                );
                var a3 = exports.assertion({method: 'mockMethod', error: e2});
                a_list.push(a3);
                if (options.log) {
                    async.nextTick(function () {
                        options.log(a3);
                    });
                }
            }
            if (err) {
                var a2 = exports.assertion({error: err});
                a_list.push(a2);
                if (options.log) {
                    async.nextTick(function () {
                        options.log(a2);
                    });
                }
            }
            var end = new Date().getTime();
            async.nextTick(function () {
                var assertion_list = exports.assertionList(a_list, end - start);
                options.testDone(name, assertion_list);
                callback(null, a_list);
            });
        },
        ok: wrapAssert('ok', 'ok', 2),
        same: wrapAssert('same', 'deepEqual', 3),
        equals: wrapAssert('equals', 'equal', 3),
        expect: function (num) {
            expecting = num;
        },
        mockFunction: function(name) {
            var callNumber = 0;
            var myExpectedCalls = Array.prototype.slice.call(arguments, 1);
            expectedCalls += myExpectedCalls.length;
            return function() {

                // Detect call
                callNumber++;
                if (myExpectedCalls.length == 0) {
                    test.fail('Calling "' + name + '" function more times, than expected. Call #' + callNumber);
                    return;
                }
                expectedCalls--;

                var expectedCall = myExpectedCalls.shift();

                // Trigger custom logic, if any
                if (typeof expectedCall === 'function') {
                    return expectedCall.apply(null, arguments);
                }

                // Expand short form
                if (Array.isArray(expectedCall)) {
                    expectedCall = { arguments: expectedCall };
                }

                // Check arguments
                var expectedArguments = expectedCall.arguments || [];

                if (arguments.length != expectedArguments.length) {
                    test.fail(
                        'Wrong "' + name + '" function argument count. Expected ' + expectedArguments.length + ', got ' +
                        arguments.length + ', call #' + callNumber
                    );
                }
                else {
                    for (var i = 0; i < arguments.length; i++) {
                        test.deepEqual(arguments[i], expectedArguments[i],
                            'Wrong "' + name + '" function argument #' + (i+1) + ' value. Expected "' + expectedArguments[i] + '" got "' +
                            arguments[i] + '", call #' + callNumber
                        );
                    }
                }

                // Construct
                if (expectedCall.construct) {
                    // _.assign(this, expectedCall.construct):
                    for (var prop in expectedCall.construct) {
                        if (expectedCall.construct.hasOwnProperty(prop)) {
                            this[prop] = expectedCall.construct[prop];
                        }
                    }
                }

                // Throw
                if (expectedCall.throw) {
                    throw expectedCall.throw;
                }

                // Return
                return expectedCall.return;
            };
        },
        _assertion_list: a_list
    };
    // add all functions from the assert module
    for (var k in assert) {
        if (assert.hasOwnProperty(k)) {
            test[k] = wrapAssert(k, k, assert[k].length);
        }
    }
    return test;
};

/**
 * Ensures an options object has all callbacks, adding empty callback functions
 * if any are missing.
 *
 * @param {Object} opt
 * @return {Object}
 * @api public
 */

exports.options = function (opt) {
    var optionalCallback = function (name) {
        opt[name] = opt[name] || function () {};
    };

    optionalCallback('moduleStart');
    optionalCallback('moduleDone');
    optionalCallback('testStart');
    optionalCallback('testReady');
    optionalCallback('testDone');
    //optionalCallback('log');

    // 'done' callback is not optional.

    return opt;
};
