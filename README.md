# Express Middleware for HTTP "Timeout" Header

This module implements [my proposal for an HTTP Timeout header](https://github.com/brendanlong/dash-http-timeout/blob/master/http-timeout-header.md) (see also [this blog post](https://www.brendanlong.com/http-timeout-header-for-requesting-resources-from-the-future.html)), indicating to a server that if a file doesn't exist, it should watch for it until the timeout expires. This allows clients to request files that they know will exist soon (like MPEG-DASH segments during live streaming) and receive them immediately after they are created.

**Warning: Due to limitations in Node.js's [`fs.watch`](https://nodejs.org/docs/latest/api/fs.html), we can't tell when a writer finishes writing a file. If you use this module, you should atomically move files into the folder (using [`rename`](http://linux.die.net/man/2/rename) for example). In future versions I intend to fix this by using [inotify](http://man7.org/linux/man-pages/man7/inotify.7.html) directly and waiting for `IN_WRITE_CLOSE`.**

## Installing

    npm install express-timeout-header

## Example

    var express = require("express");
    var expressTimeout = require("express-timeout-header");

    var staticFolder = "static";
    var port = 8080;

    var app = express;
    app.use(expressTimeout(staticFolder));
    app.use(express.static(staticFolder))
    app.listen(port);

Note that the timeout header middleware should generally come before any static file servers, since all the middleware does is hold onto the request until the requested file appears or the timeout expires.

See [this repo](https://github.com/brendanlong/dash-http-timeout) for a more complete example (in CoffeeScript).
