/*jshint node: true */
'use strict';

const Fs = require('fs');
const Path = require('path');
const Joi = require('joi');
const nunjucks = require('nunjucks');
const dataPlugin = require('./data');
const templatesDir = Path.join(__dirname, '/../templates');

const SpacelessExtension = require('nunjucks-tag-spaceless');
const AutoEscapeExtension = require('nunjucks-autoescape')(nunjucks);
const ExtraFilters = require('./nunjucks_filters');

const env = nunjucks.configure(templatesDir, {
  autoescape: false
});
ExtraFilters(env);
env.addExtension('spaceless', new SpacelessExtension());
env.addExtension('AutoEscapeExtension', new AutoEscapeExtension(env));

function render(templateName, data, callback) {
  var template = Path.join(templatesDir, templateName);

  if (!Fs.existsSync(template)) {
    console.log( 'Template', templateName, 'not found');
    return null;
  }

  try {
    return nunjucks.render(template, data);
  }
  catch(e) {
    console.log(e);
    return '';
  }
};

module.exports.render = render;

const NunjucksHapi = {
  compile: function (template, options) {
    return function (context, options) {
      return nunjucks.renderString(template, context);
    }
  }
};

module.exports.register = function (plugin, options) {

  plugin.views({
    engines: {
      html: NunjucksHapi,
    },
    path: templatesDir,
    isCached: false
  });


  plugin.route({
    method: 'GET',
    path: '/',
    handler: function (request, h) {
      const files = Fs.readdirSync(templatesDir);
      return h.response(files
          .filter(function (file) {
            return Fs.statSync(Path.join(templatesDir, file)).isFile() &&
              (request.query.filter !== undefined ?
                file.indexOf(request.query.filter) > -1 :
                true);
          })
          .map(function (file) {
            return file;
          }));
    }
  });


  plugin.route({
    method: 'GET',
    path: '/{template*}',
    config: {
      validate: {
        params: validateTemplate,
        query: Joi.object({
          u: Joi.string().uri(),
          debug: Joi.boolean()
        }),
      }
    },
    handler: async function (request, h) {
      if (request.query.u) {
        const data = await dataPlugin.get(request.query.u);
          if (data === null) {
            return h.response().code(404);
          } else {
            data.debug = request.query.debug === true;

            h.view(request.params.template, data)
            .header('Transfer-Encoding', 'chunked')
            .header('Content-Type', contentTypeHeader(request.params.template));
          }
      } else {
        return h.view(request.params.template)
        .header('Content-Type', contentTypeHeader(request.params.template));
      }
    }
  });


  plugin.route({
    method: 'POST',
    path: '/{template*}',
    config: {
      validate: {
        params: validateTemplate
      },
      payload: {
        allow: 'application/json'
      }
    },
    handler: function (request, h) {
      const content = render(request.params.template, request.payload);
      return h.response(content)
      .header('Transfer-Encoding', 'chunked')
      .header('Content-Type', contentTypeHeader(request.params.template));
    }
  });

};

module.exports.name = 'templates';

function validateTemplate (value, options) {
  const templatePath = Path.join(templatesDir, value.template);

  if (!Fs.existsSync(templatePath) || !Fs.statSync(templatePath).isFile())
    throw Error('Template ' + templatePath + ' not found');
}


function contentTypeHeader (template) {
  if (template.slice(-5) === '.html') {
    return 'text/html; charset=utf-8';
  } else {
    return 'text/plain; charset=utf-8';
  }
}
