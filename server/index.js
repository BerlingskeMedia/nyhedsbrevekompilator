require('dotenv').config();

const Hapi = require('@hapi/hapi');
const inert = require('@hapi/inert');
const vision = require('@hapi/vision');
const moment = require('moment');
const newsletters = require('./newsletters');
const templates = require('./templates');
const data = require('./data');

// This will set the locale for all plugins using moment
moment.locale('da');

var client = {
  name: 'client',
  register: function (plugin, options) {

    plugin.route({
      method: 'get',
      path: '/{param*}',
      handler: {
        directory: {
          path: 'client',
          index: true
        }
      }
    });

  }
};


var server = new Hapi.Server({
  router: {
    stripTrailingSlash: false
  },
  port: process.env.PORT ? process.env.PORT : 8000
});

(async () => {
  await server.register(inert);
  await server.register(vision);
  await server.register(client);
  await server.register(templates, { routes: { prefix: '/templates' } });
  await server.register(newsletters, { routes: { prefix: '/newsletters' } });
  await server.route({ method: 'GET', path: '/nyhedsbreve', handler: (r, h) => h.response().redirect('/') });
  await server.register(data, { routes: { prefix: '/data' } });

  server.start(function() {
    console.log('Server started on ' + server.info.uri + '.');
  });
})();

module.exports = server;
