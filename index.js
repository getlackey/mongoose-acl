/*jslint node:true, nomen: true, unparam:true */
'use strict';
/*
    Copyright 2015 Enigma Marketing Services Limited

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

var assert = require('assert'),
    clone = require('clone'),
    errors = require('common-errors');

function deep(obj, str) {
    var o = obj,
        s = (Array.isArray(str) ? str : str.split('.'));

    o = o[s.shift()];

    if (s.length > 0) {
        return deep(o, s);
    }

    return o;
}

module.exports = function (schema, options) {
    var schemaAddition = {}; // properties we will add to the schema

    options = options || {};
    options.required = options.required || ['admin'];
    options.addAuthor = !!options.addAuthor;

    options.userGrantsField = options.userGrantsField || 'grants';
    options.userIdField = options.userIdField || '_id';

    options.docGrantsField = options.docGrantsField || 'grants';
    options.authorIdField = options.authorIdField || 'author._id';

    // update the schema to include a grants array
    schemaAddition[options.userGrantsField] = [String];
    schema.add(schemaAddition);

    if (!options.defaults) {
        options.defaults = options.required.slice(0);
        // we only push public grant if the defaults haven't
        // been set. Some models will have no public access
        if (options.defaults.indexOf('public') === -1) {
            options.defaults.push('public');
        }
    }
    // Add the required grants to defaults so we add them to new docs
    // in one step
    options.required.forEach(function (grant) {
        if (options.defaults.indexOf(grant) === -1) {
            options.defaults.push(grant);
        }
    });

    function getUserGrants(user) {
        var userGrants = (user && user[options.userGrantsField] && user[options.userGrantsField].slice(0)) || [],
            authorId,
            authorGrant;

        if (userGrants.indexOf('public') === -1) {
            userGrants.push('public');
        }

        if (user && options.addAuthor) {
            authorId = deep(user, options.userIdField);
            authorGrant = 'author-' + authorId;

            if (authorId && userGrants.indexOf(authorGrant) === -1) {
                userGrants.push(authorGrant);
            }
        }

        return userGrants;
    }

    function addAclQuery(mq, user) {
        var cond = mq._conditions;

        cond[options.docGrantsField] = {
            $in: getUserGrants(user)
        };
    }

    function isUserAllowed(userGrants, grants) {
        var isAllowed = userGrants.some(function (grant) {
            if (grants.indexOf(grant) > -1) {
                return true;
            }
            return false;
        });

        return isAllowed;
    }

    // searches the doc recursively and intersects the grants.
    // Only the grants that show up on ALL grant definitions
    // will be considered
    function getGrants(doc, grants) {
        if (doc.grants) {
            if (grants) {
                grants = grants.filter(function (grant) {
                    return (doc.grants.indexOf(grant) !== -1);
                });
            } else {
                grants = clone(doc.grants);
            }
        }

        if (Array.isArray(doc)) {
            doc.forEach(function (item) {
                grants = getGrants(item, grants);
            });
        } else if (doc instanceof Object) {
            Object.keys(doc).forEach(function (key) {
                grants = getGrants(doc[key], grants);
            });
        }

        return grants;
    }

    schema.statics.checkAcl = function checkAcl(user) {
        var userGrants = getUserGrants(user);

        return function (doc) {
            var grants;

            if (!doc) {
                return doc;
            }

            assert(!Array.isArray(doc), 'Expecting a document, not an Array');

            grants = getGrants(doc);

            if (!user && grants.indexOf('public') === -1) {
                throw new errors.HttpStatusError(401, 'Unauthorized');
            }

            if (!isUserAllowed(userGrants, grants)) {
                throw new errors.HttpStatusError(403, 'Forbidden');
            }

            return doc;
        };
    };
    // add default grants to document on creation
    // throw error if required grants were remove
    schema.pre('save', function (next) {
        var self = this,
            missingGrants = [],
            err = null,
            authorGrant,
            authorId;

        if (self.isNew) {
            if (!self.grants || self.grants.length === 0) {
                self.grants = options.defaults;
            }
        } else if (self.isModified()) {
            if (!self.grants) {
                self.grants = [];
            }
        }

        options.required.forEach(function (grant) {
            if (self.grants.indexOf(grant) === -1) {
                missingGrants.push(grant);
            }
        });

        if (options.addAuthor) {
            authorId = deep(self, options.authorIdField);
            authorGrant = 'author-' + authorId;

            if (authorId && self.grants.indexOf(authorGrant) === -1) {
                self.grants.push(authorGrant);
            }
        }

        if (missingGrants.length > 0) {
            err = new Error('Missing required Grants: ' + missingGrants.join(','));
        }

        next(err);
    });

    // expose the checkAcl method in the model
    schema.on('init', function (Model) {
        // We are overwriting/extending the find methods
        // we keep the reference to the old method in __find
        // and call it in our new find method
        Model.__find = Model.find;
        Model.find = function (conditions, fields, opts, callback) {
            var self = this,
                mq = self.__find(conditions, fields, opts, callback);

            mq.checkAcl = function (user, cb) {
                var cond = addAclQuery(mq, user);

                mq.find(cond, cb);

                return mq;
            };

            return mq;
        };

        Model.__findOne = Model.findOne;
        Model.findOne = function (conditions, fields, opts, callback) {
            var self = this,
                mq = self.__findOne(conditions, fields, opts, callback);

            mq.checkAcl = function (user, cb) {
                var cond = addAclQuery(mq, user);

                mq.findOne(cond, cb);

                return mq;
            };

            return mq;
        };
    });
};