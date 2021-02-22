/*jshint node: true */
'use strict';

const MongoClient = require('mongodb').MongoClient;
let db;

const mongodb_host = process.env.MONGODB_HOST !== undefined ? process.env.MONGODB_HOST : '127.0.0.1';
const mongodb_port = process.env.MONGODB_PORT !== undefined ? process.env.MONGODB_PORT : '27017';
const mongodb_database = process.env.MONGODB_DATABASE !== undefined ? process.env.MONGODB_DATABASE : 'nyhedsbrevekompilator';
const options = { useUnifiedTopology: true };

if (process.env.MONGODB_SSL && process.env.MONGODB_CERT) {
  options.tls = true;
  options.tlsCAFile = process.env.MONGODB_CERT;
}

MongoClient.connect('mongodb://' + mongodb_host + ':' + mongodb_port,
    options,
    function(err, client) {
  if (err) throw err;
  db = client.db(mongodb_database);
  console.log('Connected to Mongo on', mongodb_host);
});

module.exports.close = function(callback) {
  db.close(callback);
};

module.exports.collection = function(collectionName) {
  return db.collection(collectionName);
};

module.exports.nyhedsbreve = function () {
  return db.collection('nyhedsbreve');
};
