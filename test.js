/* jshint mocha: true */
"use strict";

var assert = require("assert");
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

var timeout = 4;
var longTimeout = (timeout + 1) * 1000;
var shortTimeout = (timeout / 2) * 1000;
var superShortTimeout = (timeout / 4) * 1000;

describe("Existing file", function() {
    this.timeout(longTimeout);

    it("responds immediately", function(done) {
        var file = "existing.txt";
        var body = "Existing file text";

        fs.writeFile(path.join(root, file), body, function(err) {
            if (err) {
                return done(err);
            }
            request(app)
                .get(path.join("/", file))
                .timeout(shortTimeout)
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
                    .set("Prefer", "wait=" + timeout)
                    .expect(200, bodyAfter)
                    .end(done);
                setTimeout(function() {
                    fs.writeFile(fullPath, bodyAfter, function(err) {
                        if (err) {
                            return done(err);
                        }
                    });
                }, shortTimeout);
            });
        });
    });
});

describe("Non-existing file", function() {
    this.timeout(longTimeout);
    var body = "Non-existing file text";

    it("responds immediately with 404 without header", function(done) {
        var file = "new-no-header.txt";
        request(app)
            .get(path.join("/", file))
            .timeout(shortTimeout)
            .expect(404)
            .end(done);
    });

    it("responds with 404 if timeout expires", function(done) {
        var file = "new-timeout-expire.txt";
        request(app)
            .get(path.join("/", file))
            .set("Prefer", "wait=" + timeout)
            .expect(404)
            .end(done);
    });

    it("responds with 200 if file is created before timeout expires", function(done) {
        var file = "new-created.txt";
        request(app)
            .get(path.join("/", file))
            .set("Prefer", "wait=" + timeout)
            .expect(200, body)
            .end(done);
        setTimeout(function() {
            fs.writeFile(path.join(root, file), body, function(err) {
                if (err) {
                    return done(err);
                }
            });
        }, shortTimeout);
    });

    it("responds with 404 if server timeout expires", function(done) {
        var file = "short-server-timeout.txt";
        var app = express();
        app.use(middleware(root, {maxTimeout: timeout / 4 }));
        app.use(express.static(root));

        request(app)
            .get(path.join("/", file))
            .set("Prefer", "wait=" + timeout)
            .expect(404)
            .end(done);
        setTimeout(function() {
            fs.writeFile(path.join(root, file), body, function(err) {
                if (err) {
                    return done(err);
                }
            });
        }, shortTimeout);
    });

    it("responds with 404 if client timeout expires", function(done) {
        var file = "short-client-timeout.txt";
        var app = express();
        app.use(middleware(root));
        app.use(express.static(root));

        request(app)
            .get(path.join("/", file))
            .set("Prefer", "wait=" + (timeout / 4))
            .expect(404)
            .end(done);
        setTimeout(function() {
            fs.writeFile(path.join(root, file), body, function(err) {
                if (err) {
                    return done(err);
                }
            });
        }, shortTimeout);
    });
});

describe("Existing index files", function() {
    this.timeout(longTimeout);
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
                .timeout(shortTimeout)
                .expect(200, body)
                .end(done);
        });
    });
});

describe("Non-existing index files", function() {
    this.timeout(longTimeout);
    var body = "Non-existing index files test";

    it("responds immediately with 404 without header", function(done) {
        var file = "new-index-no-header.html";

        var app = express();
        app.use(middleware(root, {index: file}));
        app.use(express.static(root, {index: file}));

        request(app)
            .get("/")
            .timeout(shortTimeout)
            .expect(404)
            .end(done);
    });

    it("responds with 404 if timeout expires", function(done) {
        var file = "new-index-timeout.html";

        var app = express();
        app.use(middleware(root, {index: file}));
        app.use(express.static(root, {index: file}));

        request(app)
            .get("/")
            .set("Prefer", "wait=" + timeout)
            .expect(404)
            .end(done);
    });

    it("responds with 200 if file is created before timeout expires", function(done) {
        var file = "new-index-created.html";

        var app = express();
        app.use(middleware(root, {index: file}));
        app.use(express.static(root, {index: file}));

        request(app)
            .get("/")
            .set("Prefer", "wait=" + timeout)
            .expect(200, body)
            .end(done);
        setTimeout(function() {
            fs.writeFile(path.join(root, file), body, function(err) {
                if (err) {
                    return done(err);
                }
            });
        }, shortTimeout);
    });
});

var getPreference = middleware.getPreference;

describe("Prefer Header Parsing", function() {
    it("handles no Prefer header", function() {
        var headers = {};
        var timeout = getPreference(headers, "wait");
        assert.strictEqual(timeout, null);
    });

    it("handles non-matching preference with no value", function() {
        var headers = {"prefer": "response-async"};
        var timeout = getPreference(headers, "wait");
        assert.strictEqual(timeout, null);
    });

    it("handles non-matching preference with value", function() {
        var headers = {"prefer": "handling=lenient"};
        var timeout = getPreference(headers, "wait");
        assert.strictEqual(timeout, null);
    });

    it("handles matching preference with no value", function() {
        var headers = {"prefer": "wait"};
        var timeout = getPreference(headers, "wait");
        assert.strictEqual(timeout, null);
    });

    it("handles matching preference with value", function() {
        var headers = {"prefer": "wait=10"};
        var timeout = getPreference(headers, "wait");
        assert.equal(timeout, 10);
    });

    it("handles matching preference with value and other preferences", function() {
        var headers = {"prefer": "handling=lenient; wait=42; respond-async"};
        var timeout = getPreference(headers, "wait");
        assert.equal(timeout, 42);
    });

    it("handles duplicate preference with one value", function() {
        var headers = {"prefer": "handling=lenient; wait; wait=20; respond-async"};
        var timeout = getPreference(headers, "wait");
        assert.equal(timeout, 20);
    });

    it("handles duplicate preference with multiple values", function() {
        var headers = {"prefer": "handling=lenient; wait=99; wait=5; respond-async"};
        var timeout = getPreference(headers, "wait");
        assert.equal(timeout, 99);
    });
});
