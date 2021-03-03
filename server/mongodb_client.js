const MongoClient = require('mongodb').MongoClient;
let db;

const MONGODB_HOST = process.env.MONGODB_HOST !== undefined ? process.env.MONGODB_HOST : '127.0.0.1';
const MONGODB_PORT = process.env.MONGODB_PORT !== undefined ? process.env.MONGODB_PORT : '27017';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE !== undefined ? process.env.MONGODB_DATABASE : 'nyhedsbrevekompilator';
const {
  MONGODB_USER,
  MONGODB_PASS,
  MONGODB_REPLSET,
  MONGODB_READPREFERENCE
} = process.env;

const options = { useNewUrlParser: true, useUnifiedTopology: true };

if (process.env.MONGODB_CERT) {
  options.tls = true;
  options.tlsCAFile = process.env.MONGODB_CERT;
}

if (MONGODB_REPLSET) {
  options.replicaSet = MONGODB_REPLSET;
  options.readPreference = MONGODB_READPREFERENCE || 'secondaryPreferred';
}

let user = '';
if (MONGODB_USER && MONGODB_PASS) {
  user = `${MONGODB_USER}:${MONGODB_PASS}@`;
}
const url = 'mongodb://' + user + MONGODB_HOST + ':' + MONGODB_PORT;

MongoClient.connect(url ,
    options,
    function(err, client) {
  if (err) throw err;
  db = client.db(MONGODB_DATABASE);
  console.log('Connected to Mongo on', MONGODB_HOST);
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
