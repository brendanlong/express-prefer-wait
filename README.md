# Express Middleware for HTTP "Prefer: wait" Header

This module implements [RFC 7240](http://tools.ietf.org/html/rfc7240)'s ["Prefer: wait"](http://tools.ietf.org/html/rfc7240#section-4.3), indicating to a server that it can wait until the header expires to finish processing a request. In the case of this server, it waits for a file to appear instead of immediately responding with a 404 or 304. This allows clients to request files that they know will exist soon (like MPEG-DASH segments during live streaming) and receive them immediately after they are created.

**Warning: Due to limitations in Node.js's [`fs.watch`](https://nodejs.org/docs/latest/api/fs.html), we can't tell when a writer finishes writing a file. If you use this module, you should atomically move files into the folder (using [`rename`](http://linux.die.net/man/2/rename) for example). In future versions I intend to fix this by using [inotify](http://man7.org/linux/man-pages/man7/inotify.7.html) directly and waiting for `IN_WRITE_CLOSE`.**

## Installing

    npm install express-prefer-wait

## Example

    var express = require("express");
    var expressPreferWait = require("express-prefer-wait");

    var staticFolder = "static";
    var port = 8080;

    var app = express;
    app.use(expressPreferWait(staticFolder));
    app.use(express.static(staticFolder));
    app.listen(port);

Note that the "Prefer: wait" middleware should generally come before any static file servers, since all the middleware does is hold onto the request until the requested file appears or the timeout expires.

Specifically, the API is:

> expressPreferWait(rootDirectory, options = {etag = false, indexes = ["index.html"], maxTimeout = 60})
>
>   * rootDirectory - The root directory to serve files from. Should be the same as your static file server's root directory.
>   * etag - Set to true to wait until etag changes before sending existing file.
>   * indexes - List of files to watch when a directory is requested.
>   * maxTimeout - The maximum time to wait for a file to appear (in seconds). The actual timeout will be the minimum of `maxTimeout` and the client's "wait" preference.

Here's an example setting the maximum timeout to 10 seconds, turning on etag behavior, and watching for both "index.html" and "index.htm":

    var indexes = ["index.html", "index.htm"];
    app.use(expressTimeout(staticFolder, {etag: true, index: indexes, maxTimeout: 10}));
    app.use(express.static(staticFolder, {index: indexes);

For etags, `etag(fstat)` is used in order to match [send's behavior](https://github.com/pillarjs/send/blob/master/index.js) ("send" is the module Express's static middleware uses for etags).

See [this repo](https://github.com/brendanlong/dash-http-timeout) for a more complete example (in CoffeeScript).
