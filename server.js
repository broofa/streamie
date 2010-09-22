var sys = require('sys');
var http = require('http');
var fs = require('fs');

// Get port to run on
var port = parseInt(process.env.PORT) || 8088;

// Number of messages to send in /stream
var COUNT = 3;

sys.log('URL: http://localhost:' + port);

//
// ServerRespones extensions
//

/**
 * Write a basic web page
 */
http.ServerResponse.prototype.writePage = function(html) {
  html = html.join ? html.join('\n') : html;
  this.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/html'
  });
  this.write(html);
  this.end();
};

/**
 * Write a message formatted for forever-frame + JSONP transport
 *
 * For this test we assume the JSONP method is named 'process'
 */
http.ServerResponse.prototype.writeFrameMessage = function(msg) {
  var json = JSON.stringify(msg);
  this.write('<script>process(' + json + ');</script>\n');
};

/**
 * Write a message formatted XHR/XDR
 */
http.ServerResponse.prototype.writeJsonMessage = function(msg) {
  res.write(JSON.stringify(msg) + '\n');
};

//
// Main
//

http.createServer(function(req, res) {
  switch (req.url) {
    // The endpoint for streaming data
    case '/stream':
      // Set up for chunked encoding, disable caching
      res.writeHead(200, {
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/html',
        'Transfer-Encoding': 'chunked'
      });

      // Write prelude content
      var prelude = fs.readFileSync('stream_prelude.html', 'utf8');
      prelude = prelude.replace(/SERVER_TIME/, new Date().getTime());
      res.write(prelude);

      // Send COUNT alerts asynchronously
      var count = COUNT;
      function send() {
        var msg = {
          sentAt: new Date().getTime()
        };

        if (count-- > 0) {
          res.writeFrameMessage(msg);
          setTimeout(send, 2e3);
        } else {
          res.write('<p>-- Fin --</p></body></html>');
          res.end();
        }
      }

      // Go!
      send();
      break;

    case '/iframe':
      res.writePage('<!DOCTYPE html> \
        <html><body> \
        <iframe src="/stream"></iframe> \
        </body></html> \
      ');
      break;

    case 'favicon.ico':
    case 'robots.txt':
      // Do not wantz
      res.writeHead(404);
      res.end();
      break;

    default:
      res.writePage('<!DOCTYPE html> \
        <html><body> \
          <h1>IE9 Streaming transport test</h1> \
          <ul> \
            <li><a href="/stream">Streaming data</a></li>\
            <li><a href="/iframe">Iframe that pulls from /stream</a></li>\
          </ul> \
        </body></html> \
      ');
  };
}).listen(port);
