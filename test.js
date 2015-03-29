/* jshint mocha: true */
"use strict";

var etag = require("etag");
var express = require("express");
var fs = require("fs");
var path = require("path");
var request = require("supertest");
var tmp = require("tmp");

var middleware = require("./index.js");

var root = tmp.dirSync().name;

var app = express();
app.use(middleware(root, {etag: true}));
app.use(express.static(root));

var timeout = 200;

describe("Existing file", function() {
    it("responds immediately", function(done) {
        var file = "existing.txt";
        var body = "Existing file text";

        fs.writeFile(path.join(root, file), body, function(err) {
            if (err) {
                return done(err);
            }
            request(app)
                .get(path.join("/", file))
                .expect(200, body)
                .end(done);
        });
    });

    it("waits for etag to change before responding if If-None-Match sent", function(done) {
        var file = "existing-etag.txt";
        var fullPath = path.join(root, file);
        var bodyBefore = "Existing file with etag text (before etag change)";
        var bodyAfter = "Existing file with etag text (after etag change)";

        fs.writeFile(fullPath, bodyBefore, function(err) {
            if (err) {
                return done(err);
            }
            fs.stat(fullPath, function(err, stats) {
                if (err) {
                    return done(err);
                }
                request(app)
                    .get(path.join("/", file))
                    .set("If-None-Match", etag(stats))
                    .set("Timeout", timeout)
                    .expect(200, bodyAfter)
                    .end(done);
                setTimeout(function() {
                    fs.writeFile(fullPath, bodyAfter, function(err) {
                        if (err) {
                            return done(err);
                        }
                    });
                }, timeout / 2);
            });
        });
    });
});

describe("Non-existing file", function() {
    var file = "new.txt";
    var body = "Non-existing file text";

    it("responds immediately with 404 without header", function(done) {
        request(app)
            .get(path.join("/", file))
            .timeout(timeout / 2)
            .expect(404)
            .end(done);
    });

    it("responds with 404 if timeout expires", function(done) {
        request(app)
            .get(path.join("/", file))
            .set("Timeout", timeout)
            .expect(404)
            .end(done);
    });

    it("responds with 200 if file is created before timeout expires", function(done) {
        request(app)
            .get(path.join("/", file))
            .set("Timeout", timeout)
            .expect(200, body)
            .end(done);
        setTimeout(function() {
            fs.writeFile(path.join(root, file), body, function(err) {
                if (err) {
                    return done(err);
                }
            });
        }, timeout / 2);
    });

    it("responds with 404 if server timeout expires", function(done) {
        var file = "short-server-timeout.txt";
        var app = express();
        app.use(middleware(root, {maxTimeout: timeout / 4 }));
        app.use(express.static(root));

        request(app)
            .get(path.join("/", file))
            .set("Timeout", timeout)
            .expect(404)
            .end(done);
        setTimeout(function() {
            fs.writeFile(path.join(root, file), body, function(err) {
                if (err) {
                    return done(err);
                }
            });
        }, timeout / 2);
    });

    it("responds with 404 if client timeout expires", function(done) {
        var file = "short-client-timeout.txt";
        var app = express();
        app.use(middleware(root));
        app.use(express.static(root));

        request(app)
            .get(path.join("/", file))
            .set("Timeout", timeout / 4)
            .expect(404)
            .end(done);
        setTimeout(function() {
            fs.writeFile(path.join(root, file), body, function(err) {
                if (err) {
                    return done(err);
                }
            });
        }, timeout / 2);
    });
});

describe("Existing index files", function() {
    var index = "existing-index.html";

    var app = express();
    app.use(middleware(root, {index: index}));
    app.use(express.static(root, {index: index}));

    var body = "Existing index files text";

    it("responds immediately for index " + index, function(done) {
        fs.writeFile(path.join(root, index), body, function(err) {
            if (err) {
                return done(err);
            }
            request(app)
                .get("/")
                .expect(200, body)
                .end(done);
        });
    });
});

describe("Non-existing index files", function() {
    var file = "new-index.html";
    var body = "Non-existing index files test";

    var app = express();
    app.use(middleware(root, {index: file}));
    app.use(express.static(root, {index: file}));

    it("responds immediately with 404 without header", function(done) {
        request(app)
            .get("/")
            .expect(404)
            .end(done);
    });

    it("responds with 404 if timeout expires", function(done) {
        request(app)
            .get("/")
            .set("Timeout", timeout)
            .expect(404)
            .end(done);
    });

    it("responds with 200 if file is created before timeout expires", function(done) {
        request(app)
            .get("/")
            .set("Timeout", timeout)
            .expect(200, body)
            .end(done);
        setTimeout(function() {
            fs.writeFile(path.join(root, file), body, function(err) {
                if (err) {
                    return done(err);
                }
            });
        }, timeout / 2);
    });
});
