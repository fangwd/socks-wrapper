'use strict';

var http = require('http');
var net  = require('net');
var tls  = require('tls');
var util = require('util');
var https = require('https');

function getArgs(args) {
  var res = [9050, 'localhost'];
  if (typeof args[0] === 'object') {
    res[3] = args[0];
  } else {
    res[0] = args[0];
    if (typeof args[1] === 'string') {
      res[1] = args[1];
      res[2] = args[2];
    }
    else {
      res[2] = args[1];
    }
  }
  return res;
}

function SocksWrapper() {
  var args = getArgs(arguments);

  net.Socket.call(this, args[3]);

  var self          = this,
      socket        = new net.Socket(),
      socksResponse = null;
  
  function createSocksRequest(port, host) {
    var data = new Buffer(9);
    
    data[0] = 4;
    data[1] = 1;
    data[2] = 0xFF & (port >> 8)
    data[3] = 0xFF & port;
    data[8] = 0;
    
    if (4 == net.isIP(host)) {
      var groups = host.split('.');
      for (var i = 0; i < groups.length; i++) {
        data[4 + i] = parseInt(groups[i], 10);
      }          
    }
    else {
      data[4] = 0;
      data[5] = 0;
      data[6] = 0;
      data[7] = 1;
      
      var hostData = new Buffer(host);
      var nullByte = new Buffer(1);
      
      nullByte[0] = 0;
      
      data = Buffer.concat([data, hostData, nullByte]);
    }
    
    return data;
  }
  
  function handleSocksResponse(data) {
    socksResponse = socksResponse ? Buffer.concat(socksResponse, data) : data;
    if (socksResponse.length >= 8) {
      if (socksResponse[1] != 0x5A) {
        socket.destroy();
        self.emit('error', { code: socksResponse[1] } )
      }
      else {
        socket.removeListener('data', handleSocksResponse);
        
        self._handle       = socket._handle;
        self._handle.owner = self;
        self.readable      = socket.readable;
        self.writable      = socket.writable;
        self.connecting    = false;
        
        self.emit('connect');
      }
    }
  }
  
  this.connect = function(options) {
    this.connecting = true;
    socket.connect(args[0], args[1], function() {
      var socksRequest = createSocksRequest(options.port, options.host);
      socket.write(socksRequest);
      socket.on('data', handleSocksResponse);
    });

    socket.on('error', err => { this.emit('error', err) });
    
    return this;
  }
}

exports.SocksWrapper = SocksWrapper;

util.inherits(SocksWrapper, net.Socket);

exports.HttpAgent = function() {
  var args = getArgs(arguments);
  http.Agent.call(this, args[2]);
  this.createConnection = function(options) {
    options.port = options.port || 80;
    return new SocksWrapper(args[0], args[1]).connect(options);
  }
}

util.inherits(exports.HttpAgent, http.Agent);

exports.HttpsAgent = function() {
  var args = getArgs(arguments);
  https.Agent.call(this, args[2]);
  this.createConnection = function(options) {
    options.port = options.port || 443;
    options.socket = new SocksWrapper(args[0], args[1]).connect(options);
    return tls.connect(options)
  }
}

util.inherits(exports.HttpsAgent, http.Agent);

