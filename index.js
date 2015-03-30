/*!
 * express-timeout-header
 * Copyright (c) 2015, CableLabs, Inc.
 * All rights reserved.
 *
 * Written by Brendan Long <b.long@cablelabs.com>
 * License: BSD-2-Clause (http://opensource.org/licenses/BSD-2-Clause)
 */
"use strict";

var etag = require("etag");
var fs = require("fs");
var path = require("path");

var defaults = {
    etag: false,
    index: "index.html",
    maxTimeout: 60000
};

function getPreference(headers, preferenceName) {
    if ("prefer" in headers) {
        var preferences = headers.prefer.split(";");
        for (var i = 0; i < preferences.length; ++i) {
            var preference = preferences[i].trim();
            var keyValue = preference.split("=");
            if (keyValue.length !== 2) {
                continue;
            }
            if (keyValue[0] == preferenceName) {
                return keyValue[1];
            }
        }
    }
    return null;
}

module.exports = function(root, options) {
    options = options || {};

    root = path.resolve(root);
    for (var key in defaults) {
        if (!(key in options)) {
            options[key] = defaults[key];
        }
    }
    if (!Array.isArray(options.index)) {
        options.index = [options.index];
    }

    return function(req, res, next) {
        var timeout = Math.min(options.maxTimeout,
            getPreference(req.headers, "wait"));
        if (timeout <= 0) {
            return next();
        }

        var fullPath = path.resolve(root, "./" + req.url);

        /* Don't watch files outside of the directory */
        if (fullPath.indexOf(root) !== 0) {
            return next();
        }

        var files = [];
        if (req.url[req.url.length - 1] == "/") {
            for (var i = 0; i < options.index.length; ++i) {
                files[i] = path.join(fullPath, options.index[i]);
            }
        } else {
            files[0] = fullPath;
        }

        var watcher = null;
        var timer = null;
        var sent = false;
        var done = function() {
            if (sent) {
                return;
            }
            sent = true;
            if (watcher) {
                watcher.close();
            }
            clearTimeout(timer);
            next();
        };
        timer = setTimeout(done, timeout);

        var checkAndSend = function(file) {
            fs.stat(file, function(err, stats) {
                if (err) {
                    /* Keep waiting */
                    return;
                }
                if (stats.isFile()) {
                    if (!(options.etag && ("if-none-match" in req.headers))) {
                        return done();
                    }
                    var etags = req.headers["if-none-match"];
                    if (etag(stats) != etags) {
                        return done();
                    }
                }
            });
        };

        try {
            watcher = fs.watch(path.dirname(files[0]), function(event, changedFile) {
                for (var i = 0; i < files.length; ++i) {
                    if (changedFile == path.basename(files[i])) {
                        checkAndSend(files[i]);
                    }
                }
            });
        } catch (err) {
            done();
        }
        for (var j = 0; j < files.length; ++j) {
            checkAndSend(files[j]);
        }
    };
};

module.exports.getPreference = getPreference;
