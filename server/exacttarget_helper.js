/*jshint node: true */
'use strict';

const Https = require('https');
const clientId = process.env.EXACTTARGET_APP_CLIENT_ID;
const clientSecret = process.env.EXACTTARGET_APP_CLIENT_SECRET;
var authResponse = {};

getExactTargetAuthtoken();

console.log('Connecting to ExactTarget using ClientID', process.env.EXACTTARGET_APP_CLIENT_ID);


const createEmailAsset = function(payload, callback) {
  return callExactTarget('POST', '/asset/v1/content/assets', payload, standardCallback(callback));
};

module.exports.createEmailAsset = (payload) => new Promise((resolve, reject) => {
  createEmailAsset(payload, (err, data) => {
    if (err) {
      return reject(err);
    }
    return resolve(data);
  })
});




function standardCallback (callback) {
  return function (err, data) {
    if (err) {
      if (callback !== undefined && typeof callback === 'function') {
        callback(err);
      } else {
        console.error(Date().toString(), err);
      }
    } else if (callback !== undefined && typeof callback === 'function') {
      callback(null, data);
    }
  };
}


function callExactTarget (method, path, body, callback) {
  if (callback === undefined && typeof body === 'function') {
    callback = body;
    body = null;
  } else if(callback === undefined){
    callback = function(err, response){
      console.log(Date().toString(), 'Reponse on request to ' + path, err !== null ? err : response);
    };
  }

  if (authResponse === {}){
    return callback(new Error('ExactTarget client not initialized'));
  }

  var options = {
    hostname: 'www.exacttargetapis.com',
    port: 443,
    path: path,
    method: method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '.concat(authResponse.accessToken)
    }
  };

  var req = Https.request(options, parseReponse(df));

  if (body !== null){
    if (typeof body === 'object') {
      body = JSON.stringify(body)
    }
    req.write(body);
  }
  req.end();

  req.on('error', function (e) {
    if (callback !== undefined && typeof callback === 'function'){
      callback(e);
    } else {
      console.log(Date().toString(), 'Error on request to ' + path, e);
    }
  });

  function df(err, response){
    if(err && err.statusCode === 401){
      getExactTargetAuthtoken(function(){
        callExactTarget(method, path, body, callback);
      });
    } else {
      callback(err, response);
    }
  }
}


function getExactTargetAuthtoken (callback) {
  if (callback === undefined || typeof callback !== 'function'){
    callback = function(response){
      // Refreshing the token 30 seconds before it expires
      setTimeout(getExactTargetAuthtoken, (response.expiresIn - 30) * 1000);
    };
  }

  var options = {
    hostname: 'auth.exacttargetapis.com',
    port: 443,
    path: '/v1/requestToken',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  var req = Https.request(options, parseReponse(function(err, response){
    if (err){
      callback(err);
    } else {
      authResponse = response;
      console.log('ExactTarget authResponse', authResponse);
      callback(authResponse);
    }
  }));

  var body = {
    "clientId": clientId,
    "clientSecret": clientSecret
  };

  req.write(JSON.stringify(body));
  req.end();

  req.on('error', function (e) {
    console.log(Date().toString(), 'Error on request to ' + options.path, e);
    callback(e);
  });
}


function parseReponse (callback) {
  if (callback === undefined || typeof callback !== 'function'){
    callback = function(){};
  }

  return function(res) {
    var data = '';

    res.on('data', function(d) {
      data = data + d;
    });

    res.on('end', function() {

      if (data === ''){
        data = '{}';
      }

      try {
        data = JSON.parse(data);
      } catch (ex) {
        console.error('JSON parse error on: ', data);
        // throw ex;
        return callback(ex);
      }

      if (data.errorcode || res.statusCode > 300) {
        data.statusCode = res.statusCode;
        callback(data, null);
      } else {
        callback(null, data);
      }
    });
  };
}
