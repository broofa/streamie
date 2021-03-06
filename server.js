var sys = require('sys');
var http = require('http');
var fs = require('fs');
var url = require('url');

// Number of messages to send in /stream
var COUNT = 4;

// Get port to run on
var port = parseInt(process.env.PORT) || 8085;

// Log URL to hit
sys.log('URL: http://localhost:' + port);

//
// Extensions to Node's built-in HTTP response object
//

/**
 * Write a basic web page
 */
http.ServerResponse.prototype.sendPage = function(html, tokens) {
  html = html.join ? html.join('\n') : html;
  this.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/html'
  });

  // Optional (and primitive) token replacement
  if (tokens) {
    for (var token in tokens) {
      html = html.replace(new RegExp(token, 'g'), tokens[token]);
    }
  }
  this.write(html);
  this.end();
};

/**
 * Write a message formatted for forever-frame + JSONP transport
 *
 * For this test we assume the JSONP method is named 'process'
 */
http.ServerResponse.prototype.writeMessage = function(msg, type) {
  msg = typeof(msg) == 'string' ? msg : JSON.stringify(msg);
  if (/x[hd]r/.test(type)) {
    this.write(msg + '\n');
  } else if (type == 'frame') {
    this.write('<script>process(' + msg + ');</script>\n');
  } else {
    sys.log('unexpected type format');
  }
};

//
// Main
//

// Don't let the process die
process.on('uncaughtException', function(err) {
  console.log('Caught exception: ' + err);
});

http.createServer(function(req, res) {
  var parts = url.parse(req.url, true);
  var query = parts.query = parts.query || {};

  switch (parts.pathname) {
    // The endpoint for streaming data
    case '/stream':
      var type = (query.type) || 'frame';

      if (type == '404') {
        // For testing error handling
        res.writeHead(parseInt(query.code) || 404);
        res.end();
        return;
      } else if (type ==  'dead') {
        // For testing killed connections
        return setTimeout(function() {
          res.connection.destroy();
        }, 3e3);
      } else if (type == 'silent') {
        // For testing unresponsive servers
        return setTimeout(function() {res.end();}, 300e3);
      } else if (/x[hd]r/.test(type)) {
        // XHR/XDR stream is just \n-separated JSON objects, with no prelude.
        // We use the octet-stream type to work around Chrome's caching bug.
        // See http://code.google.com/p/chromium/issues/detail?id=2016#c41
        var headers = {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/octet-stream',
          'Transfer-Encoding': 'chunked'
        };

        // CORS support
        if (req.headers.origin) {
          headers['Access-Control-Allow-Origin'] = req.headers.origin;
        }

        res.writeHead(200, headers);
        // Send 2Kb prelude as per http://blogs.msdn.com/b/ieinternals/archive/2010/04/06/comet-streaming-in-internet-explorer-with-xmlhttprequest-and-xdomainrequest.aspx
        res.write(new Array(2048).join(' ') + '\n');
      } else {
        // Frame / htmlfile stream isa series of JSONP calls, which requires
        // some upfront script and prelude text
        res.writeHead(200, {
          'Cache-Control': 'no-cache',
          'Content-Type': 'text/html',
          'Transfer-Encoding': 'chunked'
        });

        // Write prelude content
        var prelude = fs.readFileSync('html/stream_prelude.html', 'utf8');
        prelude = prelude.replace(/SERVER_TIME/, new Date().getTime());
        res.write(prelude);
      }

      // Send COUNT messages with a 2 second delay between each one
      var count = COUNT;
      function send() {
        var msg = {
          sentAt: new Date().getTime()
        };

        if (count-- > 0) {
          // Write a message and repeat in a few seconds
          sys.log('sending ' + type + ' message');
          res.writeMessage(msg, type);
          setTimeout(send, 2e3);
        } else {
          sys.log('done');
          // All done
          if (type == 'frame') {
            res.write('<p>-- Fin --</p></body></html>');
          }
          res.end();
        }
      }
      send();
      break;

    // Do not wantz
    case '/favicon.ico':
    case '/robots.txt':
      res.writeHead(404);
      res.end();
      break;

    case '/halt':
      res.sendPage('<html><body>This is the last of earth! I am content.</body></html>');
      process.exit();
      break;

    // Serve up static pages
    default:
      var file = /\.html$/.test(parts.pathname) ? parts.pathname.replace(/\//, '') : 'index.html';
      try {
        res.sendPage(fs.readFileSync('html/' + file, 'utf8'),
                     {SERVER_TIME: new Date().getTime()});
      } catch (e) {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.write(sys.inspect(e));
        res.end();
      }
  };
}).listen(port);
