'use strict';

var http = require('http');
var net  = require('net');
var tls  = require('tls');
var util = require('util');
var https = require('https');

function SocksWrapper(port, host, options) {
  net.Socket.call(this, options);

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
    socket.connect(port, host, function() {
      var socksRequest = createSocksRequest(options.port, options.host);
      socket.write(socksRequest);
      socket.on('data', handleSocksResponse);
    });

    socket.on('error', err => { this.emit('error', err) });
    
    return this;
  }
}

function Socks5Wrapper(port, host, options) {
  net.Socket.call(this, options);

  var self          = this,
      socket        = new net.Socket(),
      socksResponse = null;

  function createSocksRequest(port, host) {
    var head = new Buffer(4);

    head[0] = 5;
    head[1] = 1;
    head[2] = 0;

    if (4 == net.isIP(host)) {
      var groups = host.split('.');
      var addr = new Buffer(4);
      for (var i = 0; i < groups.length; i++) {
        addr[i] = parseInt(groups[i], 10);
      }
      head[3] = 1;
      head = Buffer.concat([head, addr]);
    }
    else {
      var hostData = new Buffer(host);
      var sizeByte = new Buffer(1);
      sizeByte[0] = hostData.length;
      head[3] = 3;
      head = Buffer.concat([head, sizeByte, hostData]);
    }

    var portData = new Buffer(2);

    portData[0] = 0xFF & (port >> 8)
    portData[1] = 0xFF & port;

    return Buffer.concat([head, portData]);
  }

  function handleSocksResponse(data) {
    socksResponse = socksResponse ? Buffer.concat(socksResponse, data) : data;

    if (socksResponse.length < 2) {
      return;
    }

    if (socksResponse[1] != 0x00) {
      socket.destroy();
      return self.emit('error', { code: socksResponse[1] } )
    }

    function done(event, data) {
      socket.removeListener('data', handleSocksResponse);

      self._handle       = socket._handle;
      self._handle.owner = self;
      self.readable      = socket.readable;
      self.writable      = socket.writable;
      self.connecting    = false;

      self.emit(event, data);
    }

    if (socksResponse.length >= 10) {
      const addrType = socksResponse[3];
      if (addrType === 1) {
        if (socksResponse.length === 10) {
          return done('connect');
        }
        else {
          return done('error', { code: 'Bad length (1)' });
        }
      }

      if (addrType === 3) {
        const length = 5 + socksResponse[4] + 2;
        if (socksResponse.length === length) {
          return done('connect');
        }
        else if (socksResponse.length > length) {
          return done('error', { code: 'Bad length (2)' });
        }
      }
      else {
        return done('error', { code: 'Bad address type' });
      }

    }
  }

  this.connect = function(options) {
    this.connecting = true;
    socket.connect(port, host, () => {
      socks5Handshake(socket).then(() => {
        var socksRequest = createSocksRequest(options.port, options.host);
        socket.write(socksRequest);
        socket.on('data', handleSocksResponse);
      }).catch(error => {
        this.emit('error', error)
      })
    });

    socket.on('error', err => { this.emit('error', err) });

    return this;
  }
}


exports.SocksWrapper = Socks5Wrapper;

util.inherits(SocksWrapper, net.Socket);
util.inherits(Socks5Wrapper, net.Socket);

exports.HttpAgent = function(port, host, options) {
  http.Agent.call(this, options);
  this.createConnection = function(options) {
    options.port = options.port || 80;
    return new Socks5Wrapper(port, host).connect(options);
  }
}

util.inherits(exports.HttpAgent, http.Agent);

exports.HttpsAgent = function(port, host, options) {
  https.Agent.call(this, options);
  this.addRequest = (req, opts) => {
    req._last = true;
    req.shouldKeepAlive = false;
    const socket = tls.connect({ serverName: opts.hostname, rejectUnauthorized: opts.rejectUnauthorized, socket: new Socks5Wrapper(port, host).connect(opts) })
    req.onSocket(socket)
  }
}

util.inherits(exports.HttpsAgent, https.Agent);

function socks5Handshake(socket) {
  return new Promise((resolve, reject) => {
    var req = new Buffer(3);

    req[0] = 5;
    req[1] = 1;
    req[2] = 0;

    socket.write(req);

    let received = null;

    function handleData(data) {
      received = received ? Buffer.concat([received, data]) : data;
      if (received.length >= 2) {
        socket.removeListener('data', handleData);
        if (received.length > 2 || received[0] != 0x05 || received[1] != 0) {
          reject(received)
        }
        else {
          resolve()
        }
      }
    }

    socket.on('data', handleData);
  })
}

