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
    app.use(express.static(staticFolder));
    app.listen(port);

Note that the timeout header middleware should generally come before any static file servers, since all the middleware does is hold onto the request until the requested file appears or the timeout expires.

Specifically, the API is:

> expressTimeout(rootDirectory, options = {etag = false, indexes = ["index.html"], maxTimeout = 60000})
>
>   * rootDirectory - The root directory to serve files from. Should be the same as your static file server's root directory.
>   * etag - Set to true to wait until etag changes before sending existing file.
>   * indexes - List of files to watch when a directory is requested.
>   * maxTimeout - The maximum time to wait for a file to appear (in milliseconds). The actual timeout will be `min(maxTimeout, request.headers.timeout)`.

Here's an example setting the maximum timeout to 10 seconds, turning on etag behavior, and watching for both "index.html" and "index.htm":

    var indexes = ["index.html", "index.htm"];
    app.use(expressTimeout(staticFolder, {etag: true, index: indexes, maxTimeout: 10000}));
    app.use(express.static(staticFolder, {index: indexes);

For etags, `etag(fstat)` is used in order to match [send's behavior](https://github.com/pillarjs/send/blob/master/index.js) ("send" is the module Express's static middleware uses for etags).

See [this repo](https://github.com/brendanlong/dash-http-timeout) for a more complete example (in CoffeeScript).
