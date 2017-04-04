var http = require('http');

var hostname = '127.0.0.1';
var port = 3000;

var server;
var mocks = {};

function startServer() {

    server = http.createServer(function (req, res) {

        if (mocks[req.url]) {
            var requestContent = '';
            req.on('data', function (data) {
                requestContent += data;
            });
            req.on('end', function () {
                mocks[req.url](req, res, requestContent);
            });
        }
        else {
            console.error('Http mock got request to ' + req.url);

            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Not found\n');
        }
    });

    server.listen(port, hostname, function() {
        console.log('Mock http server running at http://' + hostname + ':' + port);
    });

}

module.exports.addMock = function addMock(url, callback) {

    if (!server) {
        startServer();
    }

    mocks[url] = callback;
};

module.exports.stopServer = function stopServer() {

    if (server) {
        server.close();
        server = null;
    }
};
