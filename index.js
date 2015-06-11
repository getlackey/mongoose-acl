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

module.exports = function (schema, options) {
    schema.add({
        grants: [String]
    });

    // add default grants to document on creation
    schema.pre('save', function (next) {
        var self = this,
            missingGrants = [],
            err = null;

        if (options.defaults && self.isNew) {
            if (!self.grants || self.grants.lenght === 0) {
                self.grants = options.defaults;
            }
        } else if (options.required && this.isModified()) {
            if (!self.grants) {
                self.grants = [];
            }

            options.required.forEach(function (grant) {
                if (self.grants.indexOf(grant) === -1) {
                    missingGrants.push(grant);
                }
            });
        }

        if (missingGrants.length > 0) {
            err = new Error('Missing required Grants ' + missingGrants.join(','));
        }
        next(err);
    });

    // expose the checkAcl method in the model
    schema.on('init', function (Model) {
        // We are overwriting/extending the find method
        // we keep the reference to the old method in __find
        // and call it in our new find method
        Model.__find = Model.find;

        Model.find = function (conditions, fields, options, callback) {
            var self = this,
                mq = self.__find(conditions, fields, options, callback);

            mq.checkAcl = function (user, cb) {
                var cond = mq._conditions;

                //cond.user = user._id;

                mq.find(cond, cb);

                return mq;
            };

            return mq;
        };
    });
};