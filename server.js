var sys = require('sys');
var http = require('http');
var fs = require('fs');

// Number of messages to send in /stream
var COUNT = 3;

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
http.ServerResponse.prototype.sendPage = function(html) {
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
          // Write a message and repeat in a few seconds
          res.writeFrameMessage(msg);
          setTimeout(send, 2e3);
        } else {
          // All done
          res.write('<p>-- Fin --</p></body></html>');
          res.end();
        }
      }

      // Start streaming the response
      send();
      break;

    case 'favicon.ico':
    case 'robots.txt':
      // Do not wantz
      res.writeHead(404);
      res.end();
      break;

    case '/frame_transport':
    case '/xdr_transport':
      res.sendPage(fs.readFileSync(req.url, 'utf8'));
      break;

    default:
      res.sendPage(fs.readFileSync('index.html', 'utf8'));
  };
}).listen(port);
