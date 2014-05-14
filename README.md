# Socket Wrapper Class for SOCKS Proxies

A minimal wrapper class for net.Socket to make a socket work with SOCKS proxies transparently. Socks wrapper currently supports SOCKS 4 and SOCKS 4a.

### Example with HTTP

    var http    = require('http'),
        url     = require('url'),
        wrapper = require('socks-wrapper'),
        options = url.parse('http://www.google.com');
    
    options.agent = new wrapper.HttpAgent(9050, 'localhost');

    var req = http.get(options, function(res) {
        res.on('data', function(data) {
            console.log('DATA: ' + data);
        }); 
    })
    
    req.end();
    
### Example with HTTPS

    var https   = require('https'),
        url     = require('url'),
        wrapper = require('socks-wrapper'),
        options = url.parse('https://encrypted.google.com');
    
    options.agent = new wrapper.HttpsAgent(9050, 'localhost');

    var req = https.get(options, function(res) {
        res.on('data', function(data) {
            console.log('DATA: ' + data);
        }); 
    })
    
    req.end();

