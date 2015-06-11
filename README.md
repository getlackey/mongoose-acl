# Mongoose ACL
----
**This is an early, untested, version. Pull Requests are welcome**
----
A mongoose plugin to provide granular access control. 

This module is part of the [Lackey CMS](https://lackey.io).

Access is provided with Grants - a string keyword that can be assigned to documents and users. When a query is performed only the documents that have any of the grants that the user holds, will be returned.

This plugin doesn't handle user autentication. That has to be performed with some other tool, like [passport](https://www.npmjs.com/package/passport) or Lackey's custom login. 

In the current implementation either the user has full access to the data or he doesn't. There is no attempt to define the type of access (Read, write, etc..). We are using this plugin on GET requests only. On the other methods (POST, PUT, DELETE) we just check if the user belongs to an admin or a developer group and return early otherwise. This plugin helps determined wich documents in a collection he has access to, either because he is an author or because he has been granted access to it.

There is a special grant - **public**. This grant is added by default to all documents, granting access to anyone. All requests will return documents that hold the **public** grant, even if there is no logged in user.

## Basic Usage
Just load it in a mongoose schema, just like any other plugin.

```
var acl = require('lackey-mongoose-acl');

mongoSchema = new Schema(require('./my-schema'));
mongoSchema.plugin(acl);
```

On the controller, when we perform the query.

``` 
MySchemaModel
	.find()
	.checkAcl(res.user)
	.lean(true)
	.exec()
	.then(mySuccessHandler, myErrorHandler);
```

The **checkAcl** method has been injected into the model and appends the grants validation filter to any query added to the find method. Just remember to add the **checkAcl** after the **find** method.

By default the user grant list is kept in an array named grants, eg. **res.user.grants**, but that may be defined in the options. 

If there is no user and undefined is provided to the **checkAcl** method, a grants list with only the public grant will be used. No error will be thrown in this case. 

### Options

```
var acl = require('lackey-mongoose-acl');

mongoSchema = new Schema(require('./my-schema'));
mongoSchema.plugin(acl, {
    required: ['admin', 'developer'],
    defaults: ['api', 'public'],//public is a special grant
    userGrantsField: 'grants'
    addAuthor: true,
    authorField: 'author._id'
});
```

#### required
These grants will be appended to every document and can't be removed. Either they are merged with the submitted grants or the defaults. There is no need to add the grants in both the required and defaults options. Trying to remove them from the grant list of an existing document throws an error. 

If this options is not defined, by default the **public** grant will be added.

#### defaults 
The list of grants that are added to a document on creation, if none is submitted.

#### addAuthor
Each user may have it's own, exclusive, grant. That is useful for transparently granting access to the user own documents. By default the user id will be used as a grant, prefixed by 'author-', eg. 'author-557847a1ac1235358644d8c8'.

#### authorField
The field in the document where we should get the id from. By default it searches the document for author._id or just author if it is an ObjectId.



