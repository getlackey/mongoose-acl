/*jslint node:true, nomen: true */
'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

module.exports = {
    title: String,
    author: {
        _id: Schema.Types.ObjectId,
        name: String
    }
};