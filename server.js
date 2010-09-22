var sys = require('sys');
var http = require('http');
var fs = require('fs');
var url = require('url');

// Number of messages to send in /stream
var COUNT = 4;

// Get port to run on
var port = parseInt(process.env.PORT) || 8088;

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
http.ServerResponse.prototype.writeMessage = function(msg, format) {
  msg = typeof(msg) == 'string' ? msg : JSON.stringify(msg);
  if (format == 'xhr') {
    this.write(msg + '\n');
  } else {
    this.write('<script>process(' + msg + ');</script>\n');
  }
};

//
// Main
//

http.createServer(function(req, res) {
  var parts = url.parse(req.url, true);

  switch (parts.pathname) {
    // The endpoint for streaming data
    case '/stream':
      var format = parts.query && parts.query.format;
      if (format == 'xhr') {
        // XHR/XDR stream is just \n-separated JSON objects, with no prelude.
        // We use the octet-stream type to work around Chrome's caching bug.
        // See http://code.google.com/p/chromium/issues/detail?id=2016#c41
        res.writeHead(200, {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/octet-stream',
          'Transfer-Encoding': 'chunked'
        });
      } else {
        // Frame / htmlfile stream isa series of JSONP calls, which requires
        // some upfront script and prelude text
        res.writeHead(200, {
          'Cache-Control': 'no-cache',
          'Content-Type': 'text/html',
          'Transfer-Encoding': 'chunked'
        });

        // Write prelude content
        var prelude = fs.readFileSync('stream_prelude.html', 'utf8');
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
          res.writeMessage(msg, format);
          setTimeout(send, 2e3);
        } else {
          // All done
          if (format != 'xhr') {
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

    // Serve up static pages
    default:
      var file = /\.html$/.test(req.url) ? req.url.replace(/\//, '') : 'index.html';
      try {
        res.sendPage(fs.readFileSync(file, 'utf8'), {SERVER_TIME: new Date().getTime()});
      } catch (e) {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.write(sys.inspect(e));
        res.end();
      }
  };
}).listen(port);
