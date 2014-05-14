    var https   = require('https'),
        url     = require('url'),
        wrapper = require('./index'),
        options = url.parse('https://encrypted.google.com');
    
    options.agent = new wrapper.HttpsAgent(9050, 'localhost');

    var req = https.get(options, function(res) {
        res.on('data', function(data) {
            console.log('DATA: ' + data);
        }); 
    })
    
    req.end();

