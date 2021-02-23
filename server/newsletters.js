/*jshint node: true */
'use strict';

const exacttarget = require('./exacttarget_helper');
const Joi = require('joi');
const mongodb = require('./mongodb_client.js');


const newsletter_schema = {
  _id: Joi.string().strip(),
  ident: Joi.string().alphanum(),
  last_modified: Joi.any().strip(),
  last_checksum: Joi.any().strip(),
  incomplete: Joi.any().strip(),
  name: Joi.string().min(1).max(255),
  identity: Joi.any().strip(),
  list: Joi.any().strip(),
  folder_id: [Joi.number(), Joi.string().allow('').max(100)],
  context_id: Joi.string().allow('').max(100),
  categories: Joi.array().items(Joi.string().min(1).max(100)),
  bond_url: Joi.string().uri({scheme: ['http', 'https']}),
  template_html: Joi.string().min(1).max(100),
  template_plain: Joi.strip(),
  tags: Joi.array().items(Joi.string().min(1).max(100)),
  AdditionalEmailAttribute1: Joi.string().min(1).max(100).allow('', null),
  AdditionalEmailAttribute2: Joi.string().min(1).max(100).allow('', null),
  AdditionalEmailAttribute3: Joi.string().min(1).max(100).allow('', null),
  AdditionalEmailAttribute4: Joi.string().min(1).max(100).allow('', null),
  AdditionalEmailAttribute5: Joi.string().min(1).max(100).allow('', null),
  scheduling_disabled: Joi.strip()
};

const AdditionalEmailAttribute_schema = Joi.object().keys({
  DisplayName: Joi.string().min(1).max(100),
  Name: Joi.string().min(1).max(100),
  Value: Joi.string().min(1).max(100),
  Order: Joi.number(),
  Channel: Joi.string().min(1).max(100),
  AttributeType: Joi.string().min(1).max(100)
});

const exacttarget_email_asset = {
  contentType: Joi.string().min(1).max(100).required(),
  name: Joi.string().min(1).max(100).required(),
  channels: Joi.object().keys({
    email: Joi.boolean(),
    web: Joi.boolean()
  }),
  views: Joi.object().keys({
    html: Joi.object().keys({
      content: Joi.string()
    }).required(),
    subjectline: Joi.object().keys({
      contentType: Joi.string(),
      content: Joi.string().min(1).max(255).required()
    }).required()
  }),
  category: Joi.object().keys({
    id: Joi.number()
  }),
  assetType: Joi.object().keys({
    name: Joi.string().valid('htmlemail'),
    id: Joi.number().valid(208)
  }),
  sharingProperties: Joi.object().keys({
    sharedWith: Joi.array().items(Joi.string().min(1).max(100)),
    sharingType: Joi.string().valid('local')
  }),
  data: Joi.object().keys({
    email: Joi.object().keys({
      options: Joi.object().keys({
        characterEncoding: Joi.string()
      }),
      attributes: Joi.array().items(AdditionalEmailAttribute_schema)
    })
  })
};


module.exports.name = 'newsletters';
module.exports.register = function (plugin, options) {

  plugin.route({
    method: 'get',
    path: '/admin/{param*}',
    handler: function (request, h) {
      return h.response().redirect('/');
    }
  });

  plugin.route({
    method: 'get',
    path: '/',
    handler: function (request, h) {
      return mongodb.nyhedsbreve().find({}).toArray();
    }
  });

  plugin.route({
    method: 'get',
    path: '/{ident}',
    handler: async function (request, h) {
      const newsletter = await mongodb.nyhedsbreve().findOne({ident: request.params.ident});
      if (newsletter !== null) {
        return newsletter;
      }
      return h.response().code(404);
    }
  });

  plugin.route({
    method: 'post',
    path: '/',
    config: {
        validate: {
            payload: Joi.object({
              name: Joi.string().min(1).max(100).required()
            }),
        }
    },
    handler: async function (request, h) {

      request.payload.ident = slugify(request.payload.name);

      const newsletter = await mongodb.nyhedsbreve().findOne({ident: request.payload.ident});
      if (newsletter === null) {
        const result = await mongodb.nyhedsbreve().insertOne(request.payload);
        return h.response(result.ops[0]);
      } else {
        return h.response().code(409);
      }
    }
  });

  plugin.route({
    method: 'post',
    path: '/{ident}',
    config: {
        validate: {
            params: Joi.object({
              ident: Joi.string().min(1).max(100)
            }),
            payload: Joi.object(newsletter_schema),
        }
    },
    handler: async function (request, h) {
      const response = await mongodb.nyhedsbreve().updateOne( {ident: request.params.ident},
        {
          $set: request.payload,
          $currentDate: { "last_modified": true }
      });
      if (response.result.nModified === 1) {
        return h.response();
      }

      return h.response().code(404);
    }
  });

  plugin.route({
    method: 'put',
    path: '/{ident}',
    config: {
      validate: {
        params: Joi.object({
          ident: Joi.string().min(1).max(100)
        }),
        payload: Joi.object(newsletter_schema),
      }
    },
    handler: async function (request, h) {
      const response = await mongodb.nyhedsbreve().replaceOne({ident: request.params.ident}, request.payload);
      if (response.result.nModified === 1) {
        mongodb.nyhedsbreve().updateOne(
          {ident: request.params.ident},
          {$currentDate: { "last_modified": true }});

        return h.response();
      } else {
        return h.response().code(404);
      }
    }
  });

  plugin.route({
    method: 'delete',
    path: '/{ident}',
    config: {
      validate: {
        params: Joi.object({
          ident: Joi.string().min(1).max(100)
        }),
      }
    },
    handler: async function (request, h) {
      const response = await mongodb.nyhedsbreve().deleteOne({ident: request.params.ident})
      if (response.result.n === 1) {
        return h.response();
      } else {
        return h.response().code(404);
      }
    }
  });


  plugin.route({
    method: 'post',
    path: '/upload',
    config: {
      validate: {
        payload: Joi.object(exacttarget_email_asset),
      }
    },
    handler: function (request, reply) {
      return exacttarget.createEmailAsset(request.payload);
    }
  });
};

function slugify (name) {
  return name.toString().toLowerCase()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
    .replace(/\-\-+/g, '-')      // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start of text
    .replace(/-+$/, '');         // Trim - from end of text
}
