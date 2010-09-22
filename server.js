var sys = require('sys'),
    http = require('http');

var port = parseInt(process.env.PORT) ||
           parseInt(process.env.SERVER_PORT) ||
           8001;

http.createServer(function (req, res) {
  setTimeout(function () {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    sys.puts("serving Hello");
    res.write('Hello World');
    res.close();
  }, 2000);
}).listen(port);

sys.puts('Server running at http://127.0.0.1:' + port + '/');
