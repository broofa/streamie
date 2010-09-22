/*
STREAMING FOREVER-FRAME TEST

Requires Node.js (http://nodejs.org/)

To test:
- Run "streamtest" (or "streamtest [port]") from the command line
- Open either of the indicated URLs in your browser of choice
- If the browser supports forever-frame style streaming, you will see 3 alerts at 2 second intervals
- ... and if not, you\'ll see all three alerts at once after 6 seconds.</p>',

Author: Robert Kieffer
Date: 9/17/10
*/

var sys = require('sys');
var http = require('http');

// Get port to run on
var port = parseInt(process.env.PORT) || 8088;

sys.log('URL: http://localhost:' + port);

// Generic method for writing out a string or array as a web page
http.ServerResponse.prototype.writePage = function(html) {
  html = html.join ? html.join('\n') : html;
  this.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/html'
  });
  this.write(html);
  this.end();
};

http.createServer(function(req, res) {
  // Reject stuff like favicon and robots.txt
  switch (req.url) {
    case '/stream':
      // Set up for chunked encoding, disable caching
      res.writeHead(200, {
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/html',
        'Transfer-Encoding': 'chunked'
      });

      // Write opening content
      var html = [
        '<!DOCTYPE html>',
        '<html><body>',
        new Array(1025).join(' '), // buffer buster for Chrome
        ''
      ];
      res.write(html.join('\n'));

      // Send 3 alerts asynchronously
      var count = 0;
      function send() {
        if (count++ < 3) {
          var msg = '<script>alert("' + count + ': ' +  new Date() + '");</script>\n';
          sys.log('Sent: ' + msg);
          res.write(msg);
          setTimeout(send, 2e3);
          if (count >= 3) {
            res.write('<p>-- Fin --</p></body></html>');
            res.end();
          }
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
