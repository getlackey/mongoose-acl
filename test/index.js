/*jslint node:true, unparam: true, nomen: true */
/*global describe, it, beforeEach*/
'use strict';

var assert = require("assert"),
    mongoose = require('mongoose'),
    async = require('async'),
    mongooseAcl = require('../'),
    users = require('../fixtures/users'),
    articles = require('../fixtures/articles'),
    articleSchema = require('../fixtures/article-schema'),
    Schema = mongoose.Schema;

describe('Mongoose ACL', function () {
    var connection;

    beforeEach(function (done) {
        async.series([
            //connect to DB
            function (next) {
                if (connection) {
                    connection.close();
                }

                connection = mongoose.createConnection('mongodb://localhost:17017/lackey-mongoose-acl-test');
                connection
                    .on('error', function (err) {
                        assert.ifError(err);
                    })
                    .once('open', function () {
                        next(null);
                    });
            },
            // drop articles collection
            function (next) {
                connection.db.dropCollection('articles', function (e) {
                    next();
                });
            }
        ], done);
    });

    describe('Creating Documents', function () {
        it('Should create default grants ["admin", "public"],', function (done) {
            var mongoSchema = new Schema(articleSchema);

            mongoSchema.plugin(mongooseAcl);
            connection
                .model('articles', mongoSchema)
                .create(articles)
                .then(function (items) {
                    items.forEach(function (doc) {
                        assert.deepEqual(doc.toObject().grants, ['admin', 'public'], 'Unexpected grants in document');
                    });

                    done();
                })
                .then(null, done);
        });

        it('Should include the author grant on the first 2 items', function (done) {
            var mongoSchema = new Schema(articleSchema);

            mongoSchema.plugin(mongooseAcl, {
                addAuthor: true
            });

            connection
                .model('articles', mongoSchema)
                .create(articles)
                .then(function (items) {
                    // last item has no author
                    assert.deepEqual(items.pop().toObject().grants, ['admin', 'public'], 'Unexpected grants in document');
                    // these 2 should have an author
                    items.forEach(function (doc) {
                        assert.deepEqual(doc.toObject().grants, ['admin', 'public', 'author-557847a1ac1235358644d8c8'], 'Unexpected grants in document');
                    });

                    done();
                })
                .then(null, done);
        });

        it('Should throw error with missing grants', function (done) {
            var mongoSchema = new Schema(articleSchema);

            mongoSchema.plugin(mongooseAcl, {
                required: ['admin', 'developer']
            });

            connection
                .model('articles', mongoSchema)
                .create({
                    title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
                    grants: ['developer']
                })
                .then(function (items) {
                    done(new Error('Should have thrown an error'));
                }, function (err) {
                    done();
                });
        });
    });


    describe('Retrieving Documents', function () {
        it('Should return all docs as public', function (done) {
            var mongoSchema = new Schema(articleSchema),
                Model;

            mongoSchema.plugin(mongooseAcl);
            Model = connection.model('articles', mongoSchema);

            Model
                .create(articles)
                .then(function (items) {
                    Model
                        .find()
                        .checkAcl(undefined)
                        .exec()
                        .then(function (docs) {
                            assert.equal(docs.length, 3, 'Unexpected number of docs');
                            done();
                        }, done);
                })
                .then(null, done);
        });

        it('Should return just the user docs', function (done) {
            var mongoSchema = new Schema(articleSchema),
                Model;

            mongoSchema.plugin(mongooseAcl, {
                defaults: [], //we don't need the public grant
                addAuthor: true
            });
            Model = connection.model('articles', mongoSchema);

            Model
                .create(articles)
                .then(function (items) {
                    Model
                        .find()
                        .checkAcl({
                            _id: '557847a1ac1235358644d8c8'
                        })
                        .exec()
                        .then(function (docs) {
                            assert.equal(docs.length, 2, 'Unexpected number of docs');

                            done();
                        })
                        .then(null, done);
                })
                .then(null, done);
        });

        it('Should remove the invalid properties', function () {
            var mongoSchema = new Schema(articleSchema),
                Model,
                fn,
                obj;

            mongoSchema.plugin(mongooseAcl);
            Model = connection.model('articles', mongoSchema);

            fn = Model
                .checkAcl({
                    grants: ['public']
                })
                .removeInvalid;

            obj = fn({
                "_id": "558d4ec48d77c9f0b3ba2001",
                "title": "A Document",
                "parent": {
                    "_id": "558d4ec48d77c9f0b3ba2000",
                    "grants": [
                        "admin"
                    ],
                    "title": "I'm the parent obj"
                },
                "grants": [
                    "public"
                ]
            });

            assert.deepEqual(obj, {
                "_id": "558d4ec48d77c9f0b3ba2001",
                "title": "A Document",
                "parent": {
                    "grants": [
                        "admin"
                    ]
                },
                "grants": [
                    "public"
                ]
            });
        });
    });
});