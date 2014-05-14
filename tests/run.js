var http    = require('http'),
    https   = require('https'),
    url     = require('url'),
    wrapper = require('../index.js'),
    options = url.parse('http://www.google.com');

// HTTP Example
options.agent = new wrapper.HttpAgent(9050, 'localhost');

http.get(options, function(res) {
    res.on('data', function(data) {
        console.log('HTTP: ' + data);
    }); 
}).end();

// HTTPS Example
options = url.parse('https://encrypted.google.com');
options.agent = new wrapper.HttpsAgent(9050, 'localhost');

https.get(options, function(res) {
    res.on('data', function(data) {
        console.log('HTTPS: ' + data);
    }); 
}).end();
