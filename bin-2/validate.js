/**
 *  @license
 *    Copyright 2017 Brigham Young University
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 **/
'use strict';
const is        = require('./is');
const rx        = require('./rx');
const util      = require('./util');

const smart = util.smart;
const rxPrefixSpaces = /^ */;

module.exports = validate;

function validate(v, prefix, depth, schema, value) {

    // validate anyOf
    if (v.options.anyOf && schema.anyOf) {
        const result = anyOf(v, nestedPrefix(prefix), depth, schema.anyOf, value);
        if (!result.valid) v.error(prefix, 'Did not match any of the schemas:\n' + result.errors.join('\n'));

    // validate oneOf
    } else if (v.options.oneOf && schema.oneOf) {
        const result = anyOf(v, nestedPrefix(prefix), depth, schema.oneOf, value);
        if (result.valid !== 1) v.error.push(prefix, 'Did not match exactly one schema. Matched: ' + result.valid + '\n' + result.messages.join('\n'));

    // validate allOf
    } else if (v.options.allOf && schema.allOf) {
        schema.allOf.forEach(schema => validate(v, prefix, depth, schema, value));

    // validate not
    } else if (v.options.not && schema.not) {
        not(v, prefix, depth, schema.not, value);

    // type validation
    } else {
        const type = util.schemaType(schema);
        switch (type) {
            case 'array':
                validate.array(v, prefix, depth, schema, value);
                break;
            case 'boolean':
            case 'integer':
            case 'number':
            case 'object':
                return validate[type](v, prefix, depth, schema, value);
                break;
            case 'string':
                switch (schema.format) {
                    case 'binary':
                    case 'byte':
                    case 'date':
                    case 'date-time':
                        return validate[schema.format](v, prefix, depth, schema, value);
                        break;
                    case '':
                    case undefined:
                        return validate.string(v, prefix, depth, schema, value);
                        break;
                }
                break;
        }
    }

}

validate.array = function(v, prefix, depth, schema, value) {
    if (!v.options.array) return;
    if (!Array.isArray(value)) {
        v.error(prefix, 'Expected an array. Received: ' + smart(value))
    } else {
        const length = value.length;
        if (v.options.maxItems && schema.hasOwnProperty('maxItems') && schema.maxItems < length) {
            v.error(prefix, 'Array length above maximum length of ' + schema.maxItems + ' with ' + length + ' items.');
        }
        if (v.options.minItems && schema.hasOwnProperty('minItems') && schema.minItems > length) {
            v.error(prefix, 'Array length below minimum length of ' + schema.minItems + ' with ' + length + ' items.');
        }
        if (v.options.uniqueItems && schema.uniqueItems) {
            const singles = [];
            value.forEach((item, index) => {
                const length = singles.length;
                let found;
                for (let i = 0; i < length; i++) {
                    if (util.same(item, singles[i])) {
                        v.error(prefix, 'Array values must be unique. Value is not unique at index ' + index + ': ' + item);
                        found = true;
                        break;
                    }
                }
                if (!found) singles.push(item);
            });
        }
        if (v.options.items && schema.items && v.options.depth > depth) {
            const depth1 = depth + 1;
            value.forEach((val, index) => {
                validate(v, prefix + '/' + index, depth1, schema.items, val);
            });
        }
        _enum(v, prefix, schema, value);
    }
};

validate.binary = function(v, prefix, depth, schema, value) {
    if (!v.options.binary) return;
    if (typeof value !== 'string') {
        v.error(prefix, 'Expected a string. Received: ' + smart(value));
    } else {
        if (!is.binary(value)) v.error(prefix, 'Expected a binary string. Received: ' + smart(value));
        validate.string(v, prefix, depth, schema, value);
    }
};

validate.boolean = function(v, prefix, depth, schema, value) {
    if (!v.options.boolean) return;
    if (typeof value !== 'boolean') {
        v.error(prefix, 'Expected a boolean. Received: ' + smart(value));
    } else {
        _enum(v, prefix, schema, value);
    }
};

validate.byte = function(v, prefix, depth, schema, value) {
    if (!v.options.byte) return;
    if (typeof value !== 'string') {
        v.error(prefix, 'Expected a string. Received: ' + smart(value));
    } else {
        if (!is.byte(value)) v.error(prefix, 'Expected a base64 string. Received: ' + smart(value));
        validate.string(v, prefix, depth, schema, value);
    }
};

validate.date = function(v, prefix, depth, schema, value) {
    if (!v.options.date) return;
    if (typeof value !== 'string' || !is.date(value)) {
        v.error(prefix, 'Expected a full-date string as described by RFC3339 at https://xml2rfc.tools.ietf.org/public/rfc/html/rfc3339.html#anchor14. Received: ' + smart(value));
    } else {
        date('date', v, prefix, schema, value);
        validate.string(v, prefix, depth, schema, value);
    }
};

validate.dateTime = function(v, prefix, depth, schema, value) {
    if (!v.options.dateTime) return;
    if (typeof value !== 'string' || !is.dateTime(value)) {
        v.error(prefix, 'Expected a date-time as described by RFC3339 at https://xml2rfc.tools.ietf.org/public/rfc/html/rfc3339.html#anchor14. Received: ' + smart(value));
    } else if (is.dateTime(value)) {
        date('date-time', v, prefix, schema, value);
        validate.string(v, prefix, depth, schema, value);
    }
};
validate['date-time'] = validate.dateTime;

validate.integer = function(v, prefix, depth, schema, value) {
    if (!v.options.integer) return;
    if (isNaN(value) || Math.round(value) !== value || typeof value !== 'number') {
        v.error(prefix, 'Expected an integer. Received: ' + smart(value));
    } else {
        numerical('integer', v, prefix, schema, value);
    }
};

validate.number = function(v, prefix, depth, schema, value) {
    if (!v.options.number) return;
    if (isNaN(value) || typeof value !== 'number') {
        v.error(prefix, 'Expected a number. Received: ' + smart(value));
    } else {
        numerical('number', v, prefix, schema, value);
    }
};

validate.object = function(v, prefix, depth, schema, value) {
    if (!v.options.object) return;
    if (!value || typeof value !== 'object') {
        v.error(prefix, 'Expected a non-null object. Received: ' + smart(value));
    } else {
        discriminate(v, new Map(), [], prefix, schema, value).forEach(schema => {
            const properties = schema.properties || {};
            const required = v.options.required && schema.required ? schema.required.concat() : [];
            const keys = Object.keys(value);

            // validate each property in the value
            const depth1 = depth + 1;
            keys.forEach(key => {
                const index = required.indexOf(key);
                if (index !== -1) required.splice(index, 1);

                if (v.options.depth > depth) {
                    if (properties.hasOwnProperty(key)) {
                        if (v.options.properties) validate(v, prefix + '/' + key, depth1, properties[key], value[key]);

                    } else if (v.options.additionalProperties) {
                        if (schema.additionalProperties === false) {
                            v.error(prefix + '/' + key, 'Property not allowed');
                        } else if (typeof schema.additionalProperties === 'object') {
                            validate(v, prefix + '/' + key, depth1, schema.additionalProperties, value[key]);
                        }
                    }
                }
            });

            // validate that all required are present
            if (v.options.required && required.length > 0) {
                v.error(prefix, 'One or more required properties missing: ' + required.join(', '));
            }

            // validate number of properties
            maxMin(v, prefix, schema, 'object property count', 'maxProperties', 'minProperties', false, keys.length, schema.maxProperties, schema.minProperties);

            _enum(v, prefix, schema, value);
        });
    }
};

validate.string = function(v, prefix, depth, schema, value) {
    if (!v.options.string) return;
    const length = value.length;
    if (typeof value !== 'string') {
        v.error(prefix, 'Expected a string. Received: ' + smart(value));
    } else {
        if (v.options.maxLength && schema.hasOwnProperty('maxLength') && length > schema.maxLength) {
            v.error(prefix, 'String length above maximum length of ' + schema.maxLength + ' with length of ' + length + ': ' + smart(value));
        }
        if (v.options.minLength && schema.hasOwnProperty('minLength') && length < schema.minLength) {
            v.error(prefix, 'String length below minimum length of ' + schema.minLength + ' with length of ' + length + ': ' + smart(value));
        }
        if (v.options.pattern && schema.hasOwnProperty('pattern') && !(new RegExp(schema.pattern).test(value))) {
            v.error(prefix, 'String does not match required pattern ' + schema.pattern + ' with value: ' + smart(value));
        }
        _enum(v, prefix, schema, value);
    }
};





function anyOf(v, prefix, depth, schemas, value) {
    // get reference to existing errors and overwrite temporarily
    const errorsRef = v.errors;
    const messages = [];
    const errors = [];

    // iterate through schemas to check validity
    const length = schemas.length;
    let valid = 0;
    for (let i = 0; i < length; i++) {
        const schema = schemas[i];
        v.errors = [];
        validate(v, prefix + '  ', depth, schema, value);
        if (!v.errors.length) {
            valid++;
            messages.push(prefix + 'Schema #' + (i + 1) + ': Valid');
        } else {
            const logStr = prefix + 'Schema #' + (i + 1) + ': Invalid\n' + v.errors.join('\n');
            messages.push(logStr);
            errors.push(logStr);
        }
    }

    // restore errors
    v.errors = errorsRef;

    return {
        errors: errors,
        messages: messages,
        valid: valid
    };
}

function date(descriptor, v, prefix, schema, value) {
    const suffix = descriptor === 'date-time' ? '' : 'T00:00:00.000Z';
    const match = rx.dateTime.exec(value + suffix);
    const dt = new Date(value);

    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];

    if (v.options.timeExists && (hour >= 24 || minute >= 60 || second >= 60)) {
        v.error(prefix, 'The specified time is invalid: ' + value.substr(11))
    }
    if (v.options.dateExists && (year !== dt.getUTCFullYear() || month !== dt.getUTCMonth() || day !== dt.getUTCDate())) {
        v.error(prefix, 'The specified date does not exist: ' + value.substr(0, 10));
    }

    maxMin(v, prefix, schema, descriptor, 'maximum', 'minimum', false, dt, new Date(schema.maximum), new Date(schema.minimum));
}

function _enum(v, prefix, schema, value) {
    if (v.options.enum && schema.enum) {
        const length = schema.enum.length;
        let found;
        for (let i = 0; i < length; i++) {
            if (util.same(value, schema.enum[i])) {
                found = true;
                break;
            }
        }
        if (!found) v.error(prefix, 'Value did not meet enum requirements: ' + smart(value));
    }
}

function discriminate(v, map, allOf, prefix, schema, value) {

    // avoid endless loops
    const exists = map.get(schema);
    if (exists) return exists;
    map.set(schema, true);

    if (v.options.allOf && schema.allOf) {
        schema.allOf.forEach(schema => {
            discriminate(v, map, allOf, prefix, schema, value);
        });

    } else {
        allOf.push(schema);

        if (v.options.discriminator && schema.discriminator) {
            const discriminator = v.version.getDiscriminatorSchema(schema, value);
            if (discriminator) {
                discriminate(v, map, allOf, prefix, discriminator, value);
            } else {
                const key = v.version.getDiscriminatorKey(schema, value);
                v.error(prefix, 'Undefined discriminator schema: ' + key)
            }
        }
    }

    return allOf;
}

function maxMin(v, prefix, schema, type, maxProperty, minProperty, exclusives, value, maximum, minimum) {
    if (v.options[maxProperty] && schema.hasOwnProperty(maxProperty)) {
        if (exclusives && schema.exclusiveMaximum && value >= maximum) {
            v.error(prefix, 'Expected ' + type + ' to be less than ' + schema[maxProperty] + '. Received: ' + smart(value));
        } else if (value > maximum) {
            v.error(prefix, 'Expected ' + type + ' to be less than or equal to ' + schema[maxProperty] + '. Received: ' + smart(value));
        }
    }

    if (v.options[minProperty] && schema.hasOwnProperty(minProperty)) {
        if (exclusives && schema.exclusiveMinimum && value <= minimum) {
            v.error(prefix, 'Expected ' + type + ' to be greater than ' + schema[minProperty] + '. Received: ' + smart(value));
        } else if (value < minimum) {
            v.error(prefix, 'Expected ' + type + ' to be greater than or equal to ' + schema[minProperty] + '. Received: ' + smart(value));
        }
    }
}

function nestedPrefix(prefix) {
    const indentLength = rxPrefixSpaces.exec(prefix)[0].length;
    return ' '.repeat(indentLength + 2);
}

function not(v, prefix, depth, schema, value) {
    const errors = v.errors;
    v.errors = [];

    validate(v, prefix, depth, schema, value);
    const noErrors = !v.errors.length;
    v.errors = errors;

    if (noErrors) v.error(prefix, 'Should not pass schema.');
}

function numerical(descriptor, v, prefix, schema, value) {
    maxMin(v, prefix, schema, descriptor, 'maximum', 'minimum', true, value, schema.maximum, schema.minimum);

    if (schema.multipleOf && value % schema.multipleOf !== 0) v.error(prefix, 'Expected a multiple of ' + schema.multipleOf + '. Received: ' + smart(value));

    _enum(v, prefix, schema, value);
}