'use strict';
const parser        = require('swagger-parser');
const Swagger       = require('./bin-2/swagger');

/**
 * Load a swagger enforcer instance for a custom spec.
 * @param {object} functions The custom spec functions.
 * @param {string|object} definition
 * @param {object} [options]
 * @returns {Promise.<Swagger>}
 */
exports.custom = function(functions, definition, options) {
    return parser.validate(definition)
        .then(schema => {
            return new Swagger(functions, schema, options);
        });
};

/**
 * Load a swagger enforcer instance for spec version 2.0.
 * @param {string|object} definition
 * @param {object} [options]
 * @returns {Promise.<Swagger>}
 */
exports.v2 = function(definition, options) {
    const functions = require('./bin-2/versions/v2');
    return exports.custom(functions, definition, options);
};

/**
 * Load a swagger enforcer instance for spec version 3.0.0.
 * @param {string|object} definition
 * @param {object} [options]
 * @returns {Promise.<Swagger>}
 */
exports.v3 = function(definition, options) {
    throw Error('Swagger v3 not yet implemented');
    const functions = require('./bin-2/versions/v3');
    return exports.custom(functions, definition, options);
};

/*
const enforcer              = require('./bin/enforcer');
enforcer.applyTemplate      = require('./bin/apply-template');
enforcer.injectParameters   = require('./bin/inject-parameters');
enforcer.is                 = require('./bin/is');
enforcer.release            = require('./bin/release');
enforcer.same               = require('./bin/same');
enforcer.to                 = require('./bin/convert-to');

module.exports = enforcer;*/
