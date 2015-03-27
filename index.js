/*!
 * express-timeout-header
 * Copyright (c) 2015, CableLabs, Inc.
 * All rights reserved.
 *
 * Written by Brendan Long <b.long@cablelabs.com>
 * License: BSD-2-Clause (http://opensource.org/licenses/BSD-2-Clause)
 */
"use strict";

var fs = require("fs");
var path = require("path");

var defaults = {
    maxTimeout: 60000
};

module.exports = function(root, options) {
    for (var key in defaults) {
        if (!(key in options)) {
            options[key] = defaults[key];
        }
    }

    return function(req, res, next) {
        var file = path.join(root, "./" + req.url);

        /* Don't bother watching files outside of the directory */
        if (file.indexOf(root) !== 0) {
            return next();
        }

        if (req.url[req.url.length - 1] == "/") {
            file = path.join(file, "index.html");
        }

        fs.exists(file, function(exists) {
            if (exists) {
                return next();
            }

            var timeout = 0;
            if ("timeout" in req.headers) {
                timeout = Math.min(options.maxTimeout, req.headers.timeout);
            }
            if (timeout <= 0) {
                return next();
            }

            var watcher = null;
            var timer = null;
            var done = function() {
                if (watcher) {
                    watcher.close();
                }
                clearTimeout(timer);
                next();
            };
            try {
                watcher = fs.watch(path.dirname(file), function(event, changedFile) {
                    if (changedFile == path.basename(file)) {
                        done();
                    }
                });
                timer = setTimeout(done, timeout);
            } catch (err) {
                done();
            }
        });
    };
};
