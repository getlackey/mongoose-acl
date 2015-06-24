# Mongoose ACL
----
**This is an early, barely tested, version. Pull Requests are welcome**
----

A mongoose plugin to provide granular access control. 

This module is part of the [Lackey CMS](https://lackey.io).

Access is provided with Grants - a string keyword that can be assigned to documents and users. When a query is performed only the documents that have any of the grants that the user holds, will be returned. 

This plugin doesn't handle user autentication. That has to be performed with some other tool, like [passport](https://www.npmjs.com/package/passport) or Lackey's custom login. 

In the current implementation either the user has full access to the data or he doesn't. There is no attempt to define the type of access (Read, write, etc..). We are using this plugin on GET requests only. On the other methods (POST, PUT, DELETE) we just check if the user belongs to an admin or a developer group and return early otherwise. This plugin helps determine which documents in a collection the user has access to, either because he is an author or because he has been granted access to the document.

There are two special grants - **public** and **admin**. The **public** grant is added by default to all documents, granting access to anyone. All requests will return documents that hold the **public** grant, even if there is no logged in user. The **admin** grant is used if no required grants are defined in the plugin, so we have an easy way to grant full access to any user.

## Basic Usage
Just load it in a mongoose schema, just like any other plugin.

```
var acl = require('lackey-mongoose-acl');

mongoSchema = new Schema(require('./my-schema'));
mongoSchema.plugin(acl);
```

And then, on the controller, when we perform the query.

``` 
MySchemaModel
	.find()
	.checkAcl(res.user) // res.user = {grants:['admin', ...]}
	.lean(true)
	.exec()
	.then(mySuccessHandler, myErrorHandler);
```

The **checkAcl** method has been injected into the model and appends the grants validation filter to any query added to the find method. Just remember to add the **checkAcl** after the **find** method.

By default, the user grant list is kept in an array named grants, eg. **res.user.grants**, but that may be defined in the options. 

If there is no user and undefined is provided to the **checkAcl** method, a grants list with only the public grant will be used. No error will be thrown in this case. 

The plugin only returns documents that were granted to the user. When requesting a single document, this will end up triggering an HTTP 404 Not Found instead of an HTTP 403 Forbidden.

``` 
MySchemaModel
	.findOne()
	.checkAcl(res.user) // res.user = {grants:['admin', ...]}
	.lean(true)
	.exec()
	.then(mySuccessHandler, myErrorHandler);
```

If you're a pedantic HTTP API developer this will not be acceptable - a proper HTTP **must** be returned. So you can check ACL **after** the query has been performed. That will trigger an 403 [HttpStatusError](https://www.npmjs.com/package/common-errors#httpstatus), if the user isn't allowed to access the document. No user, triggers an HTTP 401 Unauthorized.

``` 
MySchemaModel
	.findOne()
	.lean(true)
	.exec()
	.then(MySchemaModel.checkAcl(res.user))
	.then(mySuccessHandler, myErrorHandler);
```

### Options

An example with all the available options:

```
var acl = require('lackey-mongoose-acl');

mongoSchema = new Schema(require('./my-schema'));
mongoSchema.plugin(acl, {
    required: ['admin', 'developer'],
    defaults: ['api', 'public'],//public is a special grant
    docGrantsField: 'grants',
    userGrantsField: 'grants',
    userIdField: '_id',
    addAuthor: true,
    authorIdField: 'author._id'
});
```

#### required
These grants will be appended to every document and can't be removed. Either they are merged with the submitted grants or the defaults. There is no need to add the grants in both the required and defaults options. Trying to remove them from the grant list of an existing document throws an error. 

If this options is not defined, by default the **admin** grant will be added.

#### defaults 
The list of grants that are added to a document on creation, if none is submitted. 

An empty array **[ ]** will not add the public grant - only the required grants will be added.

#### docGrantsField
The property in this schema where we will store the grants array. By default it's **grants**.

#### userGrantsField
The property in the user object that is provided to **checkAcl** where we can find the grants array. By default it's **grants**.

#### userIdField
The id property for the user. Used when **addAuthor** is enabled and the author grant isn't defined.

#### addAuthor
Each user may have it's own, exclusive, grant. This is disabled by default.

Useful for transparently granting access to the user own documents. By default the user _id will be used as a grant, prefixed by 'author-', eg. 'author-557847a1ac1235358644d8c8'.

When providing the logged in user in **checkAcl** make sure either his own grant is provided or the id is defined.

```
var user = {
	id: '557847a1ac1235358644d8c8'
	grants: [
		'admin', 
		'promotions'
	]
};
```

or, don't include the id but include the grant:

```
var user = {
	grants: [
		'admin', 
		'promotions',
		'author-557847a1ac1235358644d8c8'
	]
};
```

#### authorIdField
The field in the document where we should get the id from. By default it searches the document for author._id.



