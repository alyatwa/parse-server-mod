'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _node = require('parse/node');

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _intersect = require('intersect');

var _intersect2 = _interopRequireDefault(_intersect);

var _deepcopy = require('deepcopy');

var _deepcopy2 = _interopRequireDefault(_deepcopy);

var _logger = require('../logger');

var _logger2 = _interopRequireDefault(_logger);

var _SchemaController = require('./SchemaController');

var SchemaController = _interopRequireWildcard(_SchemaController);

var _StorageAdapter = require('../Adapters/Storage/StorageAdapter');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }
// A database adapter that works with data exported from the hosted
// Parse database.

// -disable-next

// -disable-next

// -disable-next

// -disable-next


function addWriteACL(query, acl) {
  const newQuery = _lodash2.default.cloneDeep(query);
  //Can't be any existing '_wperm' query, we don't allow client queries on that, no need to $and
  newQuery._wperm = { "$in": [null, ...acl] };
  return newQuery;
}

function addReadACL(query, acl) {
  const newQuery = _lodash2.default.cloneDeep(query);
  //Can't be any existing '_rperm' query, we don't allow client queries on that, no need to $and
  newQuery._rperm = { "$in": [null, "*", ...acl] };
  return newQuery;
}

// Transforms a REST API formatted ACL object to our two-field mongo format.
const transformObjectACL = (_ref) => {
  let { ACL } = _ref,
      result = _objectWithoutProperties(_ref, ['ACL']);

  if (!ACL) {
    return result;
  }

  result._wperm = [];
  result._rperm = [];

  for (const entry in ACL) {
    if (ACL[entry].read) {
      result._rperm.push(entry);
    }
    if (ACL[entry].write) {
      result._wperm.push(entry);
    }
  }
  return result;
};

const specialQuerykeys = ['$and', '$or', '$nor', '_rperm', '_wperm', '_perishable_token', '_email_verify_token', '_email_verify_token_expires_at', '_account_lockout_expires_at', '_failed_login_count'];

const isSpecialQueryKey = key => {
  return specialQuerykeys.indexOf(key) >= 0;
};

const validateQuery = query => {
  if (query.ACL) {
    throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Cannot query on ACL.');
  }

  if (query.$or) {
    if (query.$or instanceof Array) {
      query.$or.forEach(validateQuery);

      /* In MongoDB, $or queries which are not alone at the top level of the
       * query can not make efficient use of indexes due to a long standing
       * bug known as SERVER-13732.
       *
       * This block restructures queries in which $or is not the sole top
       * level element by moving all other top-level predicates inside every
       * subdocument of the $or predicate, allowing MongoDB's query planner
       * to make full use of the most relevant indexes.
       *
       * EG:      {$or: [{a: 1}, {a: 2}], b: 2}
       * Becomes: {$or: [{a: 1, b: 2}, {a: 2, b: 2}]}
       *
       * The only exceptions are $near and $nearSphere operators, which are
       * constrained to only 1 operator per query. As a result, these ops
       * remain at the top level
       *
       * https://jira.mongodb.org/browse/SERVER-13732
       * https://github.com/parse-community/parse-server/issues/3767
       */
      Object.keys(query).forEach(key => {
        const noCollisions = !query.$or.some(subq => subq.hasOwnProperty(key));
        let hasNears = false;
        if (query[key] != null && typeof query[key] == 'object') {
          hasNears = '$near' in query[key] || '$nearSphere' in query[key];
        }
        if (key != '$or' && noCollisions && !hasNears) {
          query.$or.forEach(subquery => {
            subquery[key] = query[key];
          });
          delete query[key];
        }
      });
      query.$or.forEach(validateQuery);
    } else {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Bad $or format - use an array value.');
    }
  }

  if (query.$and) {
    if (query.$and instanceof Array) {
      query.$and.forEach(validateQuery);
    } else {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Bad $and format - use an array value.');
    }
  }

  if (query.$nor) {
    if (query.$nor instanceof Array && query.$nor.length > 0) {
      query.$nor.forEach(validateQuery);
    } else {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Bad $nor format - use an array of at least 1 value.');
    }
  }

  Object.keys(query).forEach(key => {
    if (query && query[key] && query[key].$regex) {
      if (typeof query[key].$options === 'string') {
        if (!query[key].$options.match(/^[imxs]+$/)) {
          throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, `Bad $options value for query: ${query[key].$options}`);
        }
      }
    }
    if (!isSpecialQueryKey(key) && !key.match(/^[a-zA-Z][a-zA-Z0-9_\.]*$/)) {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid key name: ${key}`);
    }
  });
};

// Filters out any data that shouldn't be on this REST-formatted object.
const filterSensitiveData = (isMaster, aclGroup, className, object) => {
  if (className !== '_User') {
    return object;
  }

  object.password = object._hashed_password;
  delete object._hashed_password;

  delete object.sessionToken;

  if (isMaster) {
    return object;
  }
  delete object._email_verify_token;
  delete object._perishable_token;
  delete object._perishable_token_expires_at;
  delete object._tombstone;
  delete object._email_verify_token_expires_at;
  delete object._failed_login_count;
  delete object._account_lockout_expires_at;
  delete object._password_changed_at;
  delete object._password_history;

  if (aclGroup.indexOf(object.objectId) > -1) {
    return object;
  }
  delete object.authData;
  return object;
};

// Runs an update on the database.
// Returns a promise for an object with the new values for field
// modifications that don't know their results ahead of time, like
// 'increment'.
// Options:
//   acl:  a list of strings. If the object to be updated has an ACL,
//         one of the provided strings must provide the caller with
//         write permissions.
const specialKeysForUpdate = ['_hashed_password', '_perishable_token', '_email_verify_token', '_email_verify_token_expires_at', '_account_lockout_expires_at', '_failed_login_count', '_perishable_token_expires_at', '_password_changed_at', '_password_history'];

const isSpecialUpdateKey = key => {
  return specialKeysForUpdate.indexOf(key) >= 0;
};

function expandResultOnKeyPath(object, key, value) {
  if (key.indexOf('.') < 0) {
    object[key] = value[key];
    return object;
  }
  const path = key.split('.');
  const firstKey = path[0];
  const nextPath = path.slice(1).join('.');
  object[firstKey] = expandResultOnKeyPath(object[firstKey] || {}, nextPath, value[firstKey]);
  delete object[key];
  return object;
}

function sanitizeDatabaseResult(originalObject, result) {
  const response = {};
  if (!result) {
    return Promise.resolve(response);
  }
  Object.keys(originalObject).forEach(key => {
    const keyUpdate = originalObject[key];
    // determine if that was an op
    if (keyUpdate && typeof keyUpdate === 'object' && keyUpdate.__op && ['Add', 'AddUnique', 'Remove', 'Increment'].indexOf(keyUpdate.__op) > -1) {
      // only valid ops that produce an actionable result
      // the op may have happend on a keypath
      expandResultOnKeyPath(response, key, result);
    }
  });
  return Promise.resolve(response);
}

function joinTableName(className, key) {
  return `_Join:${key}:${className}`;
}

const flattenUpdateOperatorsForCreate = object => {
  for (const key in object) {
    if (object[key] && object[key].__op) {
      switch (object[key].__op) {
        case 'Increment':
          if (typeof object[key].amount !== 'number') {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = object[key].amount;
          break;
        case 'Add':
          if (!(object[key].objects instanceof Array)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = object[key].objects;
          break;
        case 'AddUnique':
          if (!(object[key].objects instanceof Array)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = object[key].objects;
          break;
        case 'Remove':
          if (!(object[key].objects instanceof Array)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = [];
          break;
        case 'Delete':
          delete object[key];
          break;
        default:
          throw new _node.Parse.Error(_node.Parse.Error.COMMAND_UNAVAILABLE, `The ${object[key].__op} operator is not supported yet.`);
      }
    }
  }
};

const transformAuthData = (className, object, schema) => {
  if (object.authData && className === '_User') {
    Object.keys(object.authData).forEach(provider => {
      const providerData = object.authData[provider];
      const fieldName = `_auth_data_${provider}`;
      if (providerData == null) {
        object[fieldName] = {
          __op: 'Delete'
        };
      } else {
        object[fieldName] = providerData;
        schema.fields[fieldName] = { type: 'Object' };
      }
    });
    delete object.authData;
  }
};
// Transforms a Database format ACL to a REST API format ACL
const untransformObjectACL = (_ref2) => {
  let { _rperm, _wperm } = _ref2,
      output = _objectWithoutProperties(_ref2, ['_rperm', '_wperm']);

  if (_rperm || _wperm) {
    output.ACL = {};

    (_rperm || []).forEach(entry => {
      if (!output.ACL[entry]) {
        output.ACL[entry] = { read: true };
      } else {
        output.ACL[entry]['read'] = true;
      }
    });

    (_wperm || []).forEach(entry => {
      if (!output.ACL[entry]) {
        output.ACL[entry] = { write: true };
      } else {
        output.ACL[entry]['write'] = true;
      }
    });
  }
  return output;
};

/**
 * When querying, the fieldName may be compound, extract the root fieldName
 *     `temperature.celsius` becomes `temperature`
 * @param {string} fieldName that may be a compound field name
 * @returns {string} the root name of the field
 */
const getRootFieldName = fieldName => {
  return fieldName.split('.')[0];
};

const relationSchema = { fields: { relatedId: { type: 'String' }, owningId: { type: 'String' } } };

class DatabaseController {

  constructor(adapter, schemaCache) {
    this.adapter = adapter;
    this.schemaCache = schemaCache;
    // We don't want a mutable this.schema, because then you could have
    // one request that uses different schemas for different parts of
    // it. Instead, use loadSchema to get a schema.
    this.schemaPromise = null;
  }

  collectionExists(className) {
    return this.adapter.classExists(className);
  }

  purgeCollection(className) {
    return this.loadSchema().then(schemaController => schemaController.getOneSchema(className)).then(schema => this.adapter.deleteObjectsByQuery(className, schema, {}));
  }

  validateClassName(className) {
    if (!SchemaController.classNameIsValid(className)) {
      return Promise.reject(new _node.Parse.Error(_node.Parse.Error.INVALID_CLASS_NAME, 'invalid className: ' + className));
    }
    return Promise.resolve();
  }

  // Returns a promise for a schemaController.
  loadSchema(options = { clearCache: false }) {
    if (this.schemaPromise != null) {
      return this.schemaPromise;
    }
    this.schemaPromise = SchemaController.load(this.adapter, this.schemaCache, options);
    this.schemaPromise.then(() => delete this.schemaPromise, () => delete this.schemaPromise);
    return this.loadSchema(options);
  }

  // Returns a promise for the classname that is related to the given
  // classname through the key.
  // TODO: make this not in the DatabaseController interface
  redirectClassNameForKey(className, key) {
    return this.loadSchema().then(schema => {
      var t = schema.getExpectedType(className, key);
      if (t != null && typeof t !== 'string' && t.type === 'Relation') {
        return t.targetClass;
      }
      return className;
    });
  }

  // Uses the schema to validate the object (REST API format).
  // Returns a promise that resolves to the new schema.
  // This does not update this.schema, because in a situation like a
  // batch request, that could confuse other users of the schema.
  validateObject(className, object, query, { acl }) {
    let schema;
    const isMaster = acl === undefined;
    var aclGroup = acl || [];
    return this.loadSchema().then(s => {
      schema = s;
      if (isMaster) {
        return Promise.resolve();
      }
      return this.canAddField(schema, className, object, aclGroup);
    }).then(() => {
      return schema.validateObject(className, object, query);
    });
  }

  update(className, query, update, {
    acl,
    many,
    upsert
  } = {}, skipSanitization = false) {
    const originalQuery = query;
    const originalUpdate = update;
    // Make a copy of the object, so we don't mutate the incoming data.
    update = (0, _deepcopy2.default)(update);
    var relationUpdates = [];
    var isMaster = acl === undefined;
    var aclGroup = acl || [];
    return this.loadSchema().then(schemaController => {
      return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, 'update')).then(() => {
        relationUpdates = this.collectRelationUpdates(className, originalQuery.objectId, update);
        if (!isMaster) {
          query = this.addPointerPermissions(schemaController, className, 'update', query, aclGroup);
        }
        if (!query) {
          return Promise.resolve();
        }
        if (acl) {
          query = addWriteACL(query, acl);
        }
        validateQuery(query);
        return schemaController.getOneSchema(className, true).catch(error => {
          // If the schema doesn't exist, pretend it exists with no fields. This behavior
          // will likely need revisiting.
          if (error === undefined) {
            return { fields: {} };
          }
          throw error;
        }).then(schema => {
          Object.keys(update).forEach(fieldName => {
            if (fieldName.match(/^authData\.([a-zA-Z0-9_]+)\.id$/)) {
              throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid field name for update: ${fieldName}`);
            }
            const rootFieldName = getRootFieldName(fieldName);
            if (!SchemaController.fieldNameIsValid(rootFieldName) && !isSpecialUpdateKey(rootFieldName)) {
              throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid field name for update: ${fieldName}`);
            }
          });
          for (const updateOperation in update) {
            if (update[updateOperation] && typeof update[updateOperation] === 'object' && Object.keys(update[updateOperation]).some(innerKey => innerKey.includes('$') || innerKey.includes('.'))) {
              throw new _node.Parse.Error(_node.Parse.Error.INVALID_NESTED_KEY, "Nested keys should not contain the '$' or '.' characters");
            }
          }
          update = transformObjectACL(update);
          transformAuthData(className, update, schema);
          if (many) {
            return this.adapter.updateObjectsByQuery(className, schema, query, update);
          } else if (upsert) {
            return this.adapter.upsertOneObject(className, schema, query, update);
          } else {
            return this.adapter.findOneAndUpdate(className, schema, query, update);
          }
        });
      }).then(result => {
        if (!result) {
          throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
        }
        return this.handleRelationUpdates(className, originalQuery.objectId, update, relationUpdates).then(() => {
          return result;
        });
      }).then(result => {
        if (skipSanitization) {
          return Promise.resolve(result);
        }
        return sanitizeDatabaseResult(originalUpdate, result);
      });
    });
  }

  // Collect all relation-updating operations from a REST-format update.
  // Returns a list of all relation updates to perform
  // This mutates update.
  collectRelationUpdates(className, objectId, update) {
    var ops = [];
    var deleteMe = [];
    objectId = update.objectId || objectId;

    var process = (op, key) => {
      if (!op) {
        return;
      }
      if (op.__op == 'AddRelation') {
        ops.push({ key, op });
        deleteMe.push(key);
      }

      if (op.__op == 'RemoveRelation') {
        ops.push({ key, op });
        deleteMe.push(key);
      }

      if (op.__op == 'Batch') {
        for (var x of op.ops) {
          process(x, key);
        }
      }
    };

    for (const key in update) {
      process(update[key], key);
    }
    for (const key of deleteMe) {
      delete update[key];
    }
    return ops;
  }

  // Processes relation-updating operations from a REST-format update.
  // Returns a promise that resolves when all updates have been performed
  handleRelationUpdates(className, objectId, update, ops) {
    var pending = [];
    objectId = update.objectId || objectId;
    ops.forEach(({ key, op }) => {
      if (!op) {
        return;
      }
      if (op.__op == 'AddRelation') {
        for (const object of op.objects) {
          pending.push(this.addRelation(key, className, objectId, object.objectId));
        }
      }

      if (op.__op == 'RemoveRelation') {
        for (const object of op.objects) {
          pending.push(this.removeRelation(key, className, objectId, object.objectId));
        }
      }
    });

    return Promise.all(pending);
  }

  // Adds a relation.
  // Returns a promise that resolves successfully iff the add was successful.
  addRelation(key, fromClassName, fromId, toId) {
    const doc = {
      relatedId: toId,
      owningId: fromId
    };
    return this.adapter.upsertOneObject(`_Join:${key}:${fromClassName}`, relationSchema, doc, doc);
  }

  // Removes a relation.
  // Returns a promise that resolves successfully iff the remove was
  // successful.
  removeRelation(key, fromClassName, fromId, toId) {
    var doc = {
      relatedId: toId,
      owningId: fromId
    };
    return this.adapter.deleteObjectsByQuery(`_Join:${key}:${fromClassName}`, relationSchema, doc).catch(error => {
      // We don't care if they try to delete a non-existent relation.
      if (error.code == _node.Parse.Error.OBJECT_NOT_FOUND) {
        return;
      }
      throw error;
    });
  }

  // Removes objects matches this query from the database.
  // Returns a promise that resolves successfully iff the object was
  // deleted.
  // Options:
  //   acl:  a list of strings. If the object to be updated has an ACL,
  //         one of the provided strings must provide the caller with
  //         write permissions.
  destroy(className, query, { acl } = {}) {
    const isMaster = acl === undefined;
    const aclGroup = acl || [];

    return this.loadSchema().then(schemaController => {
      return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, 'delete')).then(() => {
        if (!isMaster) {
          query = this.addPointerPermissions(schemaController, className, 'delete', query, aclGroup);
          if (!query) {
            throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
          }
        }
        // delete by query
        if (acl) {
          query = addWriteACL(query, acl);
        }
        validateQuery(query);
        return schemaController.getOneSchema(className).catch(error => {
          // If the schema doesn't exist, pretend it exists with no fields. This behavior
          // will likely need revisiting.
          if (error === undefined) {
            return { fields: {} };
          }
          throw error;
        }).then(parseFormatSchema => this.adapter.deleteObjectsByQuery(className, parseFormatSchema, query)).catch(error => {
          // When deleting sessions while changing passwords, don't throw an error if they don't have any sessions.
          if (className === "_Session" && error.code === _node.Parse.Error.OBJECT_NOT_FOUND) {
            return Promise.resolve({});
          }
          throw error;
        });
      });
    });
  }

  // Inserts an object into the database.
  // Returns a promise that resolves successfully iff the object saved.
  create(className, object, { acl } = {}) {
    // Make a copy of the object, so we don't mutate the incoming data.
    const originalObject = object;
    object = transformObjectACL(object);

    object.createdAt = { iso: object.createdAt, __type: 'Date' };
    object.updatedAt = { iso: object.updatedAt, __type: 'Date' };

    var isMaster = acl === undefined;
    var aclGroup = acl || [];
    const relationUpdates = this.collectRelationUpdates(className, null, object);
    return this.validateClassName(className).then(() => this.loadSchema()).then(schemaController => {
      return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, 'create')).then(() => schemaController.enforceClassExists(className)).then(() => schemaController.reloadData()).then(() => schemaController.getOneSchema(className, true)).then(schema => {
        transformAuthData(className, object, schema);
        flattenUpdateOperatorsForCreate(object);
        return this.adapter.createObject(className, SchemaController.convertSchemaToAdapterSchema(schema), object);
      }).then(result => {
        return this.handleRelationUpdates(className, object.objectId, object, relationUpdates).then(() => {
          return sanitizeDatabaseResult(originalObject, result.ops[0]);
        });
      });
    });
  }

  canAddField(schema, className, object, aclGroup) {
    const classSchema = schema.data[className];
    if (!classSchema) {
      return Promise.resolve();
    }
    const fields = Object.keys(object);
    const schemaFields = Object.keys(classSchema);
    const newKeys = fields.filter(field => {
      // Skip fields that are unset
      if (object[field] && object[field].__op && object[field].__op === 'Delete') {
        return false;
      }
      return schemaFields.indexOf(field) < 0;
    });
    if (newKeys.length > 0) {
      return schema.validatePermission(className, aclGroup, 'addField');
    }
    return Promise.resolve();
  }

  // Won't delete collections in the system namespace
  /**
   * Delete all classes and clears the schema cache
   *
   * @param {boolean} fast set to true if it's ok to just delete rows and not indexes
   * @returns {Promise<void>} when the deletions completes
   */
  deleteEverything(fast = false) {
    this.schemaPromise = null;
    return Promise.all([this.adapter.deleteAllClasses(fast), this.schemaCache.clear()]);
  }

  // Returns a promise for a list of related ids given an owning id.
  // className here is the owning className.
  relatedIds(className, key, owningId, queryOptions) {
    const { skip, limit, sort } = queryOptions;
    const findOptions = {};
    if (sort && sort.createdAt && this.adapter.canSortOnJoinTables) {
      findOptions.sort = { '_id': sort.createdAt };
      findOptions.limit = limit;
      findOptions.skip = skip;
      queryOptions.skip = 0;
    }
    return this.adapter.find(joinTableName(className, key), relationSchema, { owningId }, findOptions).then(results => results.map(result => result.relatedId));
  }

  // Returns a promise for a list of owning ids given some related ids.
  // className here is the owning className.
  owningIds(className, key, relatedIds) {
    return this.adapter.find(joinTableName(className, key), relationSchema, { relatedId: { '$in': relatedIds } }, {}).then(results => results.map(result => result.owningId));
  }

  // Modifies query so that it no longer has $in on relation fields, or
  // equal-to-pointer constraints on relation fields.
  // Returns a promise that resolves when query is mutated
  reduceInRelation(className, query, schema) {
    // Search for an in-relation or equal-to-relation
    // Make it sequential for now, not sure of paralleization side effects
    if (query['$or']) {
      const ors = query['$or'];
      return Promise.all(ors.map((aQuery, index) => {
        return this.reduceInRelation(className, aQuery, schema).then(aQuery => {
          query['$or'][index] = aQuery;
        });
      })).then(() => {
        return Promise.resolve(query);
      });
    }

    const promises = Object.keys(query).map(key => {
      const t = schema.getExpectedType(className, key);
      if (!t || t.type !== 'Relation') {
        return Promise.resolve(query);
      }
      let queries = null;
      if (query[key] && (query[key]['$in'] || query[key]['$ne'] || query[key]['$nin'] || query[key].__type == 'Pointer')) {
        // Build the list of queries
        queries = Object.keys(query[key]).map(constraintKey => {
          let relatedIds;
          let isNegation = false;
          if (constraintKey === 'objectId') {
            relatedIds = [query[key].objectId];
          } else if (constraintKey == '$in') {
            relatedIds = query[key]['$in'].map(r => r.objectId);
          } else if (constraintKey == '$nin') {
            isNegation = true;
            relatedIds = query[key]['$nin'].map(r => r.objectId);
          } else if (constraintKey == '$ne') {
            isNegation = true;
            relatedIds = [query[key]['$ne'].objectId];
          } else {
            return;
          }
          return {
            isNegation,
            relatedIds
          };
        });
      } else {
        queries = [{ isNegation: false, relatedIds: [] }];
      }

      // remove the current queryKey as we don,t need it anymore
      delete query[key];
      // execute each query independently to build the list of
      // $in / $nin
      const promises = queries.map(q => {
        if (!q) {
          return Promise.resolve();
        }
        return this.owningIds(className, key, q.relatedIds).then(ids => {
          if (q.isNegation) {
            this.addNotInObjectIdsIds(ids, query);
          } else {
            this.addInObjectIdsIds(ids, query);
          }
          return Promise.resolve();
        });
      });

      return Promise.all(promises).then(() => {
        return Promise.resolve();
      });
    });

    return Promise.all(promises).then(() => {
      return Promise.resolve(query);
    });
  }

  // Modifies query so that it no longer has $relatedTo
  // Returns a promise that resolves when query is mutated
  reduceRelationKeys(className, query, queryOptions) {

    if (query['$or']) {
      return Promise.all(query['$or'].map(aQuery => {
        return this.reduceRelationKeys(className, aQuery, queryOptions);
      }));
    }

    var relatedTo = query['$relatedTo'];
    if (relatedTo) {
      return this.relatedIds(relatedTo.object.className, relatedTo.key, relatedTo.object.objectId, queryOptions).then(ids => {
        delete query['$relatedTo'];
        this.addInObjectIdsIds(ids, query);
        return this.reduceRelationKeys(className, query, queryOptions);
      }).then(() => {});
    }
  }

  addInObjectIdsIds(ids = null, query) {
    const idsFromString = typeof query.objectId === 'string' ? [query.objectId] : null;
    const idsFromEq = query.objectId && query.objectId['$eq'] ? [query.objectId['$eq']] : null;
    const idsFromIn = query.objectId && query.objectId['$in'] ? query.objectId['$in'] : null;

    // -disable-next
    const allIds = [idsFromString, idsFromEq, idsFromIn, ids].filter(list => list !== null);
    const totalLength = allIds.reduce((memo, list) => memo + list.length, 0);

    let idsIntersection = [];
    if (totalLength > 125) {
      idsIntersection = _intersect2.default.big(allIds);
    } else {
      idsIntersection = (0, _intersect2.default)(allIds);
    }

    // Need to make sure we don't clobber existing shorthand $eq constraints on objectId.
    if (!('objectId' in query)) {
      query.objectId = {
        $in: undefined
      };
    } else if (typeof query.objectId === 'string') {
      query.objectId = {
        $in: undefined,
        $eq: query.objectId
      };
    }
    query.objectId['$in'] = idsIntersection;

    return query;
  }

  addNotInObjectIdsIds(ids = [], query) {
    const idsFromNin = query.objectId && query.objectId['$nin'] ? query.objectId['$nin'] : [];
    let allIds = [...idsFromNin, ...ids].filter(list => list !== null);

    // make a set and spread to remove duplicates
    allIds = [...new Set(allIds)];

    // Need to make sure we don't clobber existing shorthand $eq constraints on objectId.
    if (!('objectId' in query)) {
      query.objectId = {
        $nin: undefined
      };
    } else if (typeof query.objectId === 'string') {
      query.objectId = {
        $nin: undefined,
        $eq: query.objectId
      };
    }

    query.objectId['$nin'] = allIds;
    return query;
  }

  // Runs a query on the database.
  // Returns a promise that resolves to a list of items.
  // Options:
  //   skip    number of results to skip.
  //   limit   limit to this number of results.
  //   sort    an object where keys are the fields to sort by.
  //           the value is +1 for ascending, -1 for descending.
  //   count   run a count instead of returning results.
  //   acl     restrict this operation with an ACL for the provided array
  //           of user objectIds and roles. acl: null means no user.
  //           when this field is not present, don't do anything regarding ACLs.
  // TODO: make userIds not needed here. The db adapter shouldn't know
  // anything about users, ideally. Then, improve the format of the ACL
  // arg to work like the others.
  find(className, query, {
    skip,
    limit,
    acl,
    sort = {},
    count,
    keys,
    op,
    distinct,
    pipeline,
    readPreference,
    isWrite
  } = {}) {
    const isMaster = acl === undefined;
    const aclGroup = acl || [];
    op = op || (typeof query.objectId == 'string' && Object.keys(query).length === 1 ? 'get' : 'find');
    // Count operation if counting
    op = count === true ? 'count' : op;

    let classExists = true;
    return this.loadSchema().then(schemaController => {
      //Allow volatile classes if querying with Master (for _PushStatus)
      //TODO: Move volatile classes concept into mongo adapter, postgres adapter shouldn't care
      //that api.parse.com breaks when _PushStatus exists in mongo.
      return schemaController.getOneSchema(className, isMaster).catch(error => {
        // Behavior for non-existent classes is kinda weird on Parse.com. Probably doesn't matter too much.
        // For now, pretend the class exists but has no objects,
        if (error === undefined) {
          classExists = false;
          return { fields: {} };
        }
        throw error;
      }).then(schema => {
        // Parse.com treats queries on _created_at and _updated_at as if they were queries on createdAt and updatedAt,
        // so duplicate that behavior here. If both are specified, the correct behavior to match Parse.com is to
        // use the one that appears first in the sort list.
        if (sort._created_at) {
          sort.createdAt = sort._created_at;
          delete sort._created_at;
        }
        if (sort._updated_at) {
          sort.updatedAt = sort._updated_at;
          delete sort._updated_at;
        }
        const queryOptions = { skip, limit, sort, keys, readPreference };
        Object.keys(sort).forEach(fieldName => {
          if (fieldName.match(/^authData\.([a-zA-Z0-9_]+)\.id$/)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Cannot sort by ${fieldName}`);
          }
          const rootFieldName = getRootFieldName(fieldName);
          if (!SchemaController.fieldNameIsValid(rootFieldName)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid field name: ${fieldName}.`);
          }
        });
        return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, op)).then(() => this.reduceRelationKeys(className, query, queryOptions)).then(() => this.reduceInRelation(className, query, schemaController)).then(() => {
          if (!isMaster) {
            query = this.addPointerPermissions(schemaController, className, op, query, aclGroup);
          }
          if (!query) {
            if (op == 'get') {
              throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
            } else {
              return [];
            }
          }
          if (!isMaster) {
            if (isWrite) {
              query = addWriteACL(query, aclGroup);
            } else {
              query = addReadACL(query, aclGroup);
            }
          }
          validateQuery(query);
          if (count) {
            if (!classExists) {
              return 0;
            } else {
              return this.adapter.count(className, schema, query, readPreference);
            }
          } else if (distinct) {
            if (!classExists) {
              return [];
            } else {
              return this.adapter.distinct(className, schema, query, distinct);
            }
          } else if (pipeline) {
            if (!classExists) {
              return [];
            } else {
              return this.adapter.aggregate(className, schema, pipeline, readPreference);
            }
          } else {
            return this.adapter.find(className, schema, query, queryOptions).then(objects => objects.map(object => {
              object = untransformObjectACL(object);
              return filterSensitiveData(isMaster, aclGroup, className, object);
            })).catch(error => {
              throw new _node.Parse.Error(_node.Parse.Error.INTERNAL_SERVER_ERROR, error);
            });
          }
        });
      });
    });
  }

  deleteSchema(className) {
    return this.loadSchema({ clearCache: true }).then(schemaController => schemaController.getOneSchema(className, true)).catch(error => {
      if (error === undefined) {
        return { fields: {} };
      } else {
        throw error;
      }
    }).then(schema => {
      return this.collectionExists(className).then(() => this.adapter.count(className, { fields: {} })).then(count => {
        if (count > 0) {
          throw new _node.Parse.Error(255, `Class ${className} is not empty, contains ${count} objects, cannot drop schema.`);
        }
        return this.adapter.deleteClass(className);
      }).then(wasParseCollection => {
        if (wasParseCollection) {
          const relationFieldNames = Object.keys(schema.fields).filter(fieldName => schema.fields[fieldName].type === 'Relation');
          return Promise.all(relationFieldNames.map(name => this.adapter.deleteClass(joinTableName(className, name)))).then(() => {
            return;
          });
        } else {
          return Promise.resolve();
        }
      });
    });
  }

  addPointerPermissions(schema, className, operation, query, aclGroup = []) {
    // Check if class has public permission for operation
    // If the BaseCLP pass, let go through
    if (schema.testBaseCLP(className, aclGroup, operation)) {
      return query;
    }
    const perms = schema.perms[className];
    const field = ['get', 'find'].indexOf(operation) > -1 ? 'readUserFields' : 'writeUserFields';
    const userACL = aclGroup.filter(acl => {
      return acl.indexOf('role:') != 0 && acl != '*';
    });
    // the ACL should have exactly 1 user
    if (perms && perms[field] && perms[field].length > 0) {
      // No user set return undefined
      // If the length is > 1, that means we didn't de-dupe users correctly
      if (userACL.length != 1) {
        return;
      }
      const userId = userACL[0];
      const userPointer = {
        "__type": "Pointer",
        "className": "_User",
        "objectId": userId
      };

      const permFields = perms[field];
      const ors = permFields.map(key => {
        const q = {
          [key]: userPointer
        };
        // if we already have a constraint on the key, use the $and
        if (query.hasOwnProperty(key)) {
          return { '$and': [q, query] };
        }
        // otherwise just add the constaint
        return Object.assign({}, query, {
          [`${key}`]: userPointer
        });
      });
      if (ors.length > 1) {
        return { '$or': ors };
      }
      return ors[0];
    } else {
      return query;
    }
  }

  // TODO: create indexes on first creation of a _User object. Otherwise it's impossible to
  // have a Parse app without it having a _User collection.
  performInitialization() {
    const requiredUserFields = { fields: _extends({}, SchemaController.defaultColumns._Default, SchemaController.defaultColumns._User) };
    const requiredRoleFields = { fields: _extends({}, SchemaController.defaultColumns._Default, SchemaController.defaultColumns._Role) };

    const publicuser = {
      fields: _extends({}, SchemaController.defaultColumns._Default, SchemaController.defaultColumns._PublicUser)
    };
    const privaterecord = {
      fields: _extends({}, SchemaController.defaultColumns._Default, SchemaController.defaultColumns._PrivateRecord)
    };
    const records = {
      fields: _extends({}, SchemaController.defaultColumns._Default, SchemaController.defaultColumns._Records)
    };

    const userClassPromise = this.loadSchema().then(schema => schema.enforceClassExists('_User'));
    const roleClassPromise = this.loadSchema().then(schema => schema.enforceClassExists('_Role'));

    const publicuserPromise = this.loadSchema().then(schema => schema.enforceClassExists('PublicUser'));
    const privaterecordPromise = this.loadSchema().then(schema => schema.enforceClassExists('PrivateRecord'));
    const recordsPromise = this.loadSchema().then(schema => schema.enforceClassExists('Records'));

    const usernameUniqueness = userClassPromise.then(() => this.adapter.ensureUniqueness('_User', requiredUserFields, ['username'])).catch(error => {
      _logger2.default.warn('Unable to ensure uniqueness for usernames: ', error);
      throw error;
    });

    const emailUniqueness = userClassPromise.then(() => this.adapter.ensureUniqueness('_User', requiredUserFields, ['email'])).catch(error => {
      _logger2.default.warn('Unable to ensure uniqueness for user email addresses: ', error);
      throw error;
    });

    const roleUniqueness = roleClassPromise.then(() => this.adapter.ensureUniqueness('_Role', requiredRoleFields, ['name'])).catch(error => {
      _logger2.default.warn('Unable to ensure uniqueness for role name: ', error);
      throw error;
    });

    const publicuserUniqueness = publicuserPromise.then(() => this.adapter.ensureUniqueness('PublicUser', publicuser, ['objectId'])).catch(error => {
      _logger2.default.warn('Unable to ensure uniqueness for publicuser: ', error);
      throw error;
    });
    const privaterecordUniqueness = privaterecordPromise.then(() => this.adapter.ensureUniqueness('PrivateRecord', privaterecord, ['objectId'])).catch(error => {
      _logger2.default.warn('Unable to ensure uniqueness for private record: ', error);
      throw error;
    });
    const recordsUniqueness = recordsPromise.then(() => this.adapter.ensureUniqueness('Records', records, ['objectId'])).catch(error => {
      _logger2.default.warn('Unable to ensure uniqueness for records: ', error);
      throw error;
    });

    const indexPromise = this.adapter.updateSchemaWithIndexes();

    // Create tables for volatile classes
    const adapterInit = this.adapter.performInitialization({ VolatileClassesSchemas: SchemaController.VolatileClassesSchemas });
    return Promise.all([usernameUniqueness, publicuserUniqueness, recordsUniqueness, privaterecordUniqueness, emailUniqueness, roleUniqueness, adapterInit, indexPromise]);
  }

}

module.exports = DatabaseController;
// Expose validateQuery for tests
module.exports._validateQuery = validateQuery;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Db250cm9sbGVycy9EYXRhYmFzZUNvbnRyb2xsZXIuanMiXSwibmFtZXMiOlsiU2NoZW1hQ29udHJvbGxlciIsImFkZFdyaXRlQUNMIiwicXVlcnkiLCJhY2wiLCJuZXdRdWVyeSIsIl8iLCJjbG9uZURlZXAiLCJfd3Blcm0iLCJhZGRSZWFkQUNMIiwiX3JwZXJtIiwidHJhbnNmb3JtT2JqZWN0QUNMIiwiQUNMIiwicmVzdWx0IiwiZW50cnkiLCJyZWFkIiwicHVzaCIsIndyaXRlIiwic3BlY2lhbFF1ZXJ5a2V5cyIsImlzU3BlY2lhbFF1ZXJ5S2V5Iiwia2V5IiwiaW5kZXhPZiIsInZhbGlkYXRlUXVlcnkiLCJQYXJzZSIsIkVycm9yIiwiSU5WQUxJRF9RVUVSWSIsIiRvciIsIkFycmF5IiwiZm9yRWFjaCIsIk9iamVjdCIsImtleXMiLCJub0NvbGxpc2lvbnMiLCJzb21lIiwic3VicSIsImhhc093blByb3BlcnR5IiwiaGFzTmVhcnMiLCJzdWJxdWVyeSIsIiRhbmQiLCIkbm9yIiwibGVuZ3RoIiwiJHJlZ2V4IiwiJG9wdGlvbnMiLCJtYXRjaCIsIklOVkFMSURfS0VZX05BTUUiLCJmaWx0ZXJTZW5zaXRpdmVEYXRhIiwiaXNNYXN0ZXIiLCJhY2xHcm91cCIsImNsYXNzTmFtZSIsIm9iamVjdCIsInBhc3N3b3JkIiwiX2hhc2hlZF9wYXNzd29yZCIsInNlc3Npb25Ub2tlbiIsIl9lbWFpbF92ZXJpZnlfdG9rZW4iLCJfcGVyaXNoYWJsZV90b2tlbiIsIl9wZXJpc2hhYmxlX3Rva2VuX2V4cGlyZXNfYXQiLCJfdG9tYnN0b25lIiwiX2VtYWlsX3ZlcmlmeV90b2tlbl9leHBpcmVzX2F0IiwiX2ZhaWxlZF9sb2dpbl9jb3VudCIsIl9hY2NvdW50X2xvY2tvdXRfZXhwaXJlc19hdCIsIl9wYXNzd29yZF9jaGFuZ2VkX2F0IiwiX3Bhc3N3b3JkX2hpc3RvcnkiLCJvYmplY3RJZCIsImF1dGhEYXRhIiwic3BlY2lhbEtleXNGb3JVcGRhdGUiLCJpc1NwZWNpYWxVcGRhdGVLZXkiLCJleHBhbmRSZXN1bHRPbktleVBhdGgiLCJ2YWx1ZSIsInBhdGgiLCJzcGxpdCIsImZpcnN0S2V5IiwibmV4dFBhdGgiLCJzbGljZSIsImpvaW4iLCJzYW5pdGl6ZURhdGFiYXNlUmVzdWx0Iiwib3JpZ2luYWxPYmplY3QiLCJyZXNwb25zZSIsIlByb21pc2UiLCJyZXNvbHZlIiwia2V5VXBkYXRlIiwiX19vcCIsImpvaW5UYWJsZU5hbWUiLCJmbGF0dGVuVXBkYXRlT3BlcmF0b3JzRm9yQ3JlYXRlIiwiYW1vdW50IiwiSU5WQUxJRF9KU09OIiwib2JqZWN0cyIsIkNPTU1BTkRfVU5BVkFJTEFCTEUiLCJ0cmFuc2Zvcm1BdXRoRGF0YSIsInNjaGVtYSIsInByb3ZpZGVyIiwicHJvdmlkZXJEYXRhIiwiZmllbGROYW1lIiwiZmllbGRzIiwidHlwZSIsInVudHJhbnNmb3JtT2JqZWN0QUNMIiwib3V0cHV0IiwiZ2V0Um9vdEZpZWxkTmFtZSIsInJlbGF0aW9uU2NoZW1hIiwicmVsYXRlZElkIiwib3duaW5nSWQiLCJEYXRhYmFzZUNvbnRyb2xsZXIiLCJjb25zdHJ1Y3RvciIsImFkYXB0ZXIiLCJzY2hlbWFDYWNoZSIsInNjaGVtYVByb21pc2UiLCJjb2xsZWN0aW9uRXhpc3RzIiwiY2xhc3NFeGlzdHMiLCJwdXJnZUNvbGxlY3Rpb24iLCJsb2FkU2NoZW1hIiwidGhlbiIsInNjaGVtYUNvbnRyb2xsZXIiLCJnZXRPbmVTY2hlbWEiLCJkZWxldGVPYmplY3RzQnlRdWVyeSIsInZhbGlkYXRlQ2xhc3NOYW1lIiwiY2xhc3NOYW1lSXNWYWxpZCIsInJlamVjdCIsIklOVkFMSURfQ0xBU1NfTkFNRSIsIm9wdGlvbnMiLCJjbGVhckNhY2hlIiwibG9hZCIsInJlZGlyZWN0Q2xhc3NOYW1lRm9yS2V5IiwidCIsImdldEV4cGVjdGVkVHlwZSIsInRhcmdldENsYXNzIiwidmFsaWRhdGVPYmplY3QiLCJ1bmRlZmluZWQiLCJzIiwiY2FuQWRkRmllbGQiLCJ1cGRhdGUiLCJtYW55IiwidXBzZXJ0Iiwic2tpcFNhbml0aXphdGlvbiIsIm9yaWdpbmFsUXVlcnkiLCJvcmlnaW5hbFVwZGF0ZSIsInJlbGF0aW9uVXBkYXRlcyIsInZhbGlkYXRlUGVybWlzc2lvbiIsImNvbGxlY3RSZWxhdGlvblVwZGF0ZXMiLCJhZGRQb2ludGVyUGVybWlzc2lvbnMiLCJjYXRjaCIsImVycm9yIiwicm9vdEZpZWxkTmFtZSIsImZpZWxkTmFtZUlzVmFsaWQiLCJ1cGRhdGVPcGVyYXRpb24iLCJpbm5lcktleSIsImluY2x1ZGVzIiwiSU5WQUxJRF9ORVNURURfS0VZIiwidXBkYXRlT2JqZWN0c0J5UXVlcnkiLCJ1cHNlcnRPbmVPYmplY3QiLCJmaW5kT25lQW5kVXBkYXRlIiwiT0JKRUNUX05PVF9GT1VORCIsImhhbmRsZVJlbGF0aW9uVXBkYXRlcyIsIm9wcyIsImRlbGV0ZU1lIiwicHJvY2VzcyIsIm9wIiwieCIsInBlbmRpbmciLCJhZGRSZWxhdGlvbiIsInJlbW92ZVJlbGF0aW9uIiwiYWxsIiwiZnJvbUNsYXNzTmFtZSIsImZyb21JZCIsInRvSWQiLCJkb2MiLCJjb2RlIiwiZGVzdHJveSIsInBhcnNlRm9ybWF0U2NoZW1hIiwiY3JlYXRlIiwiY3JlYXRlZEF0IiwiaXNvIiwiX190eXBlIiwidXBkYXRlZEF0IiwiZW5mb3JjZUNsYXNzRXhpc3RzIiwicmVsb2FkRGF0YSIsImNyZWF0ZU9iamVjdCIsImNvbnZlcnRTY2hlbWFUb0FkYXB0ZXJTY2hlbWEiLCJjbGFzc1NjaGVtYSIsImRhdGEiLCJzY2hlbWFGaWVsZHMiLCJuZXdLZXlzIiwiZmlsdGVyIiwiZmllbGQiLCJkZWxldGVFdmVyeXRoaW5nIiwiZmFzdCIsImRlbGV0ZUFsbENsYXNzZXMiLCJjbGVhciIsInJlbGF0ZWRJZHMiLCJxdWVyeU9wdGlvbnMiLCJza2lwIiwibGltaXQiLCJzb3J0IiwiZmluZE9wdGlvbnMiLCJjYW5Tb3J0T25Kb2luVGFibGVzIiwiZmluZCIsInJlc3VsdHMiLCJtYXAiLCJvd25pbmdJZHMiLCJyZWR1Y2VJblJlbGF0aW9uIiwib3JzIiwiYVF1ZXJ5IiwiaW5kZXgiLCJwcm9taXNlcyIsInF1ZXJpZXMiLCJjb25zdHJhaW50S2V5IiwiaXNOZWdhdGlvbiIsInIiLCJxIiwiaWRzIiwiYWRkTm90SW5PYmplY3RJZHNJZHMiLCJhZGRJbk9iamVjdElkc0lkcyIsInJlZHVjZVJlbGF0aW9uS2V5cyIsInJlbGF0ZWRUbyIsImlkc0Zyb21TdHJpbmciLCJpZHNGcm9tRXEiLCJpZHNGcm9tSW4iLCJhbGxJZHMiLCJsaXN0IiwidG90YWxMZW5ndGgiLCJyZWR1Y2UiLCJtZW1vIiwiaWRzSW50ZXJzZWN0aW9uIiwiaW50ZXJzZWN0IiwiYmlnIiwiJGluIiwiJGVxIiwiaWRzRnJvbU5pbiIsIlNldCIsIiRuaW4iLCJjb3VudCIsImRpc3RpbmN0IiwicGlwZWxpbmUiLCJyZWFkUHJlZmVyZW5jZSIsImlzV3JpdGUiLCJfY3JlYXRlZF9hdCIsIl91cGRhdGVkX2F0IiwiYWdncmVnYXRlIiwiSU5URVJOQUxfU0VSVkVSX0VSUk9SIiwiZGVsZXRlU2NoZW1hIiwiZGVsZXRlQ2xhc3MiLCJ3YXNQYXJzZUNvbGxlY3Rpb24iLCJyZWxhdGlvbkZpZWxkTmFtZXMiLCJuYW1lIiwib3BlcmF0aW9uIiwidGVzdEJhc2VDTFAiLCJwZXJtcyIsInVzZXJBQ0wiLCJ1c2VySWQiLCJ1c2VyUG9pbnRlciIsInBlcm1GaWVsZHMiLCJhc3NpZ24iLCJwZXJmb3JtSW5pdGlhbGl6YXRpb24iLCJyZXF1aXJlZFVzZXJGaWVsZHMiLCJkZWZhdWx0Q29sdW1ucyIsIl9EZWZhdWx0IiwiX1VzZXIiLCJyZXF1aXJlZFJvbGVGaWVsZHMiLCJfUm9sZSIsInB1YmxpY3VzZXIiLCJfUHVibGljVXNlciIsInByaXZhdGVyZWNvcmQiLCJfUHJpdmF0ZVJlY29yZCIsInJlY29yZHMiLCJfUmVjb3JkcyIsInVzZXJDbGFzc1Byb21pc2UiLCJyb2xlQ2xhc3NQcm9taXNlIiwicHVibGljdXNlclByb21pc2UiLCJwcml2YXRlcmVjb3JkUHJvbWlzZSIsInJlY29yZHNQcm9taXNlIiwidXNlcm5hbWVVbmlxdWVuZXNzIiwiZW5zdXJlVW5pcXVlbmVzcyIsImxvZ2dlciIsIndhcm4iLCJlbWFpbFVuaXF1ZW5lc3MiLCJyb2xlVW5pcXVlbmVzcyIsInB1YmxpY3VzZXJVbmlxdWVuZXNzIiwicHJpdmF0ZXJlY29yZFVuaXF1ZW5lc3MiLCJyZWNvcmRzVW5pcXVlbmVzcyIsImluZGV4UHJvbWlzZSIsInVwZGF0ZVNjaGVtYVdpdGhJbmRleGVzIiwiYWRhcHRlckluaXQiLCJWb2xhdGlsZUNsYXNzZXNTY2hlbWFzIiwibW9kdWxlIiwiZXhwb3J0cyIsIl92YWxpZGF0ZVF1ZXJ5Il0sIm1hcHBpbmdzIjoiOzs7O0FBS0E7O0FBRUE7Ozs7QUFFQTs7OztBQUVBOzs7O0FBQ0E7Ozs7QUFDQTs7SUFBWUEsZ0I7O0FBQ1o7Ozs7Ozs7QUFiQTtBQUNBOztBQUVBOztBQUVBOztBQUVBOztBQUVBOzs7QUFRQSxTQUFTQyxXQUFULENBQXFCQyxLQUFyQixFQUE0QkMsR0FBNUIsRUFBaUM7QUFDL0IsUUFBTUMsV0FBV0MsaUJBQUVDLFNBQUYsQ0FBWUosS0FBWixDQUFqQjtBQUNBO0FBQ0FFLFdBQVNHLE1BQVQsR0FBa0IsRUFBRSxPQUFRLENBQUMsSUFBRCxFQUFPLEdBQUdKLEdBQVYsQ0FBVixFQUFsQjtBQUNBLFNBQU9DLFFBQVA7QUFDRDs7QUFFRCxTQUFTSSxVQUFULENBQW9CTixLQUFwQixFQUEyQkMsR0FBM0IsRUFBZ0M7QUFDOUIsUUFBTUMsV0FBV0MsaUJBQUVDLFNBQUYsQ0FBWUosS0FBWixDQUFqQjtBQUNBO0FBQ0FFLFdBQVNLLE1BQVQsR0FBa0IsRUFBQyxPQUFPLENBQUMsSUFBRCxFQUFPLEdBQVAsRUFBWSxHQUFHTixHQUFmLENBQVIsRUFBbEI7QUFDQSxTQUFPQyxRQUFQO0FBQ0Q7O0FBRUQ7QUFDQSxNQUFNTSxxQkFBcUIsVUFBd0I7QUFBQSxNQUF2QixFQUFFQyxHQUFGLEVBQXVCO0FBQUEsTUFBYkMsTUFBYTs7QUFDakQsTUFBSSxDQUFDRCxHQUFMLEVBQVU7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Olsi77u/Ly8gQGZsb3dcbi8vIEEgZGF0YWJhc2UgYWRhcHRlciB0aGF0IHdvcmtzIHdpdGggZGF0YSBleHBvcnRlZCBmcm9tIHRoZSBob3N0ZWRcbi8vIFBhcnNlIGRhdGFiYXNlLlxuXG4vLyBAZmxvdy1kaXNhYmxlLW5leHRcbmltcG9ydCB7IFBhcnNlIH0gICAgICAgICAgICAgIGZyb20gJ3BhcnNlL25vZGUnO1xuLy8gQGZsb3ctZGlzYWJsZS1uZXh0XG5pbXBvcnQgXyAgICAgICAgICAgICAgICAgICAgICBmcm9tICdsb2Rhc2gnO1xuLy8gQGZsb3ctZGlzYWJsZS1uZXh0XG5pbXBvcnQgaW50ZXJzZWN0ICAgICAgICAgICAgICBmcm9tICdpbnRlcnNlY3QnO1xuLy8gQGZsb3ctZGlzYWJsZS1uZXh0XG5pbXBvcnQgZGVlcGNvcHkgICAgICAgICAgICAgICBmcm9tICdkZWVwY29weSc7XG5pbXBvcnQgbG9nZ2VyICAgICAgICAgICAgICAgICBmcm9tICcuLi9sb2dnZXInO1xuaW1wb3J0ICogYXMgU2NoZW1hQ29udHJvbGxlciAgICAgICBmcm9tICcuL1NjaGVtYUNvbnRyb2xsZXInO1xuaW1wb3J0IHsgU3RvcmFnZUFkYXB0ZXIgfSAgICAgZnJvbSAnLi4vQWRhcHRlcnMvU3RvcmFnZS9TdG9yYWdlQWRhcHRlcic7XG5pbXBvcnQgdHlwZSB7IFF1ZXJ5T3B0aW9ucyxcbiAgRnVsbFF1ZXJ5T3B0aW9ucyB9ICAgICAgICAgIGZyb20gJy4uL0FkYXB0ZXJzL1N0b3JhZ2UvU3RvcmFnZUFkYXB0ZXInO1xuXG5mdW5jdGlvbiBhZGRXcml0ZUFDTChxdWVyeSwgYWNsKSB7XG4gIGNvbnN0IG5ld1F1ZXJ5ID0gXy5jbG9uZURlZXAocXVlcnkpO1xuICAvL0Nhbid0IGJlIGFueSBleGlzdGluZyAnX3dwZXJtJyBxdWVyeSwgd2UgZG9uJ3QgYWxsb3cgY2xpZW50IHF1ZXJpZXMgb24gdGhhdCwgbm8gbmVlZCB0byAkYW5kXG4gIG5ld1F1ZXJ5Ll93cGVybSA9IHsgXCIkaW5cIiA6IFtudWxsLCAuLi5hY2xdfTtcbiAgcmV0dXJuIG5ld1F1ZXJ5O1xufVxuXG5mdW5jdGlvbiBhZGRSZWFkQUNMKHF1ZXJ5LCBhY2wpIHtcbiAgY29uc3QgbmV3UXVlcnkgPSBfLmNsb25lRGVlcChxdWVyeSk7XG4gIC8vQ2FuJ3QgYmUgYW55IGV4aXN0aW5nICdfcnBlcm0nIHF1ZXJ5LCB3ZSBkb24ndCBhbGxvdyBjbGllbnQgcXVlcmllcyBvbiB0aGF0LCBubyBuZWVkIHRvICRhbmRcbiAgbmV3UXVlcnkuX3JwZXJtID0ge1wiJGluXCI6IFtudWxsLCBcIipcIiwgLi4uYWNsXX07XG4gIHJldHVybiBuZXdRdWVyeTtcbn1cblxuLy8gVHJhbnNmb3JtcyBhIFJFU1QgQVBJIGZvcm1hdHRlZCBBQ0wgb2JqZWN0IHRvIG91ciB0d28tZmllbGQgbW9uZ28gZm9ybWF0LlxuY29uc3QgdHJhbnNmb3JtT2JqZWN0QUNMID0gKHsgQUNMLCAuLi5yZXN1bHQgfSkgPT4ge1xuICBpZiAoIUFDTCkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICByZXN1bHQuX3dwZXJtID0gW107XG4gIHJlc3VsdC5fcnBlcm0gPSBbXTtcblxuICBmb3IgKGNvbnN0IGVudHJ5IGluIEFDTCkge1xuICAgIGlmIChBQ0xbZW50cnldLnJlYWQpIHtcbiAgICAgIHJlc3VsdC5fcnBlcm0ucHVzaChlbnRyeSk7XG4gICAgfVxuICAgIGlmIChBQ0xbZW50cnldLndyaXRlKSB7XG4gICAgICByZXN1bHQuX3dwZXJtLnB1c2goZW50cnkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5jb25zdCBzcGVjaWFsUXVlcnlrZXlzID0gWyckYW5kJywgJyRvcicsICckbm9yJywgJ19ycGVybScsICdfd3Blcm0nLCAnX3BlcmlzaGFibGVfdG9rZW4nLCAnX2VtYWlsX3ZlcmlmeV90b2tlbicsICdfZW1haWxfdmVyaWZ5X3Rva2VuX2V4cGlyZXNfYXQnLCAnX2FjY291bnRfbG9ja291dF9leHBpcmVzX2F0JywgJ19mYWlsZWRfbG9naW5fY291bnQnXTtcblxuY29uc3QgaXNTcGVjaWFsUXVlcnlLZXkgPSBrZXkgPT4ge1xuICByZXR1cm4gc3BlY2lhbFF1ZXJ5a2V5cy5pbmRleE9mKGtleSkgPj0gMDtcbn1cblxuY29uc3QgdmFsaWRhdGVRdWVyeSA9IChxdWVyeTogYW55KTogdm9pZCA9PiB7XG4gIGlmIChxdWVyeS5BQ0wpIHtcbiAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9RVUVSWSwgJ0Nhbm5vdCBxdWVyeSBvbiBBQ0wuJyk7XG4gIH1cblxuICBpZiAocXVlcnkuJG9yKSB7XG4gICAgaWYgKHF1ZXJ5LiRvciBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICBxdWVyeS4kb3IuZm9yRWFjaCh2YWxpZGF0ZVF1ZXJ5KTtcblxuICAgICAgLyogSW4gTW9uZ29EQiwgJG9yIHF1ZXJpZXMgd2hpY2ggYXJlIG5vdCBhbG9uZSBhdCB0aGUgdG9wIGxldmVsIG9mIHRoZVxuICAgICAgICogcXVlcnkgY2FuIG5vdCBtYWtlIGVmZmljaWVudCB1c2Ugb2YgaW5kZXhlcyBkdWUgdG8gYSBsb25nIHN0YW5kaW5nXG4gICAgICAgKiBidWcga25vd24gYXMgU0VSVkVSLTEzNzMyLlxuICAgICAgICpcbiAgICAgICAqIFRoaXMgYmxvY2sgcmVzdHJ1Y3R1cmVzIHF1ZXJpZXMgaW4gd2hpY2ggJG9yIGlzIG5vdCB0aGUgc29sZSB0b3BcbiAgICAgICAqIGxldmVsIGVsZW1lbnQgYnkgbW92aW5nIGFsbCBvdGhlciB0b3AtbGV2ZWwgcHJlZGljYXRlcyBpbnNpZGUgZXZlcnlcbiAgICAgICAqIHN1YmRvY3VtZW50IG9mIHRoZSAkb3IgcHJlZGljYXRlLCBhbGxvd2luZyBNb25nb0RCJ3MgcXVlcnkgcGxhbm5lclxuICAgICAgICogdG8gbWFrZSBmdWxsIHVzZSBvZiB0aGUgbW9zdCByZWxldmFudCBpbmRleGVzLlxuICAgICAgICpcbiAgICAgICAqIEVHOiAgICAgIHskb3I6IFt7YTogMX0sIHthOiAyfV0sIGI6IDJ9XG4gICAgICAgKiBCZWNvbWVzOiB7JG9yOiBbe2E6IDEsIGI6IDJ9LCB7YTogMiwgYjogMn1dfVxuICAgICAgICpcbiAgICAgICAqIFRoZSBvbmx5IGV4Y2VwdGlvbnMgYXJlICRuZWFyIGFuZCAkbmVhclNwaGVyZSBvcGVyYXRvcnMsIHdoaWNoIGFyZVxuICAgICAgICogY29uc3RyYWluZWQgdG8gb25seSAxIG9wZXJhdG9yIHBlciBxdWVyeS4gQXMgYSByZXN1bHQsIHRoZXNlIG9wc1xuICAgICAgICogcmVtYWluIGF0IHRoZSB0b3AgbGV2ZWxcbiAgICAgICAqXG4gICAgICAgKiBodHRwczovL2ppcmEubW9uZ29kYi5vcmcvYnJvd3NlL1NFUlZFUi0xMzczMlxuICAgICAgICogaHR0cHM6Ly9naXRodWIuY29tL3BhcnNlLWNvbW11bml0eS9wYXJzZS1zZXJ2ZXIvaXNzdWVzLzM3NjdcbiAgICAgICAqL1xuICAgICAgT2JqZWN0LmtleXMocXVlcnkpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgY29uc3Qgbm9Db2xsaXNpb25zID0gIXF1ZXJ5LiRvci5zb21lKHN1YnEgPT4gc3VicS5oYXNPd25Qcm9wZXJ0eShrZXkpKVxuICAgICAgICBsZXQgaGFzTmVhcnMgPSBmYWxzZVxuICAgICAgICBpZiAocXVlcnlba2V5XSAhPSBudWxsICYmIHR5cGVvZiBxdWVyeVtrZXldID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgaGFzTmVhcnMgPSAoJyRuZWFyJyBpbiBxdWVyeVtrZXldIHx8ICckbmVhclNwaGVyZScgaW4gcXVlcnlba2V5XSlcbiAgICAgICAgfVxuICAgICAgICBpZiAoa2V5ICE9ICckb3InICYmIG5vQ29sbGlzaW9ucyAmJiAhaGFzTmVhcnMpIHtcbiAgICAgICAgICBxdWVyeS4kb3IuZm9yRWFjaChzdWJxdWVyeSA9PiB7XG4gICAgICAgICAgICBzdWJxdWVyeVtrZXldID0gcXVlcnlba2V5XTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBkZWxldGUgcXVlcnlba2V5XTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBxdWVyeS4kb3IuZm9yRWFjaCh2YWxpZGF0ZVF1ZXJ5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfUVVFUlksICdCYWQgJG9yIGZvcm1hdCAtIHVzZSBhbiBhcnJheSB2YWx1ZS4nKTtcbiAgICB9XG4gIH1cblxuICBpZiAocXVlcnkuJGFuZCkge1xuICAgIGlmIChxdWVyeS4kYW5kIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIHF1ZXJ5LiRhbmQuZm9yRWFjaCh2YWxpZGF0ZVF1ZXJ5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfUVVFUlksICdCYWQgJGFuZCBmb3JtYXQgLSB1c2UgYW4gYXJyYXkgdmFsdWUuJyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHF1ZXJ5LiRub3IpIHtcbiAgICBpZiAocXVlcnkuJG5vciBpbnN0YW5jZW9mIEFycmF5ICYmIHF1ZXJ5LiRub3IubGVuZ3RoID4gMCkge1xuICAgICAgcXVlcnkuJG5vci5mb3JFYWNoKHZhbGlkYXRlUXVlcnkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9RVUVSWSwgJ0JhZCAkbm9yIGZvcm1hdCAtIHVzZSBhbiBhcnJheSBvZiBhdCBsZWFzdCAxIHZhbHVlLicpO1xuICAgIH1cbiAgfVxuXG4gIE9iamVjdC5rZXlzKHF1ZXJ5KS5mb3JFYWNoKGtleSA9PiB7XG4gICAgaWYgKHF1ZXJ5ICYmIHF1ZXJ5W2tleV0gJiYgcXVlcnlba2V5XS4kcmVnZXgpIHtcbiAgICAgIGlmICh0eXBlb2YgcXVlcnlba2V5XS4kb3B0aW9ucyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCFxdWVyeVtrZXldLiRvcHRpb25zLm1hdGNoKC9eW2lteHNdKyQvKSkge1xuICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX1FVRVJZLCBgQmFkICRvcHRpb25zIHZhbHVlIGZvciBxdWVyeTogJHtxdWVyeVtrZXldLiRvcHRpb25zfWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghaXNTcGVjaWFsUXVlcnlLZXkoa2V5KSAmJiAha2V5Lm1hdGNoKC9eW2EtekEtWl1bYS16QS1aMC05X1xcLl0qJC8pKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9LRVlfTkFNRSwgYEludmFsaWQga2V5IG5hbWU6ICR7a2V5fWApO1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIEZpbHRlcnMgb3V0IGFueSBkYXRhIHRoYXQgc2hvdWxkbid0IGJlIG9uIHRoaXMgUkVTVC1mb3JtYXR0ZWQgb2JqZWN0LlxuY29uc3QgZmlsdGVyU2Vuc2l0aXZlRGF0YSA9IChpc01hc3RlciwgYWNsR3JvdXAsIGNsYXNzTmFtZSwgb2JqZWN0KSA9PiB7XG4gIGlmIChjbGFzc05hbWUgIT09ICdfVXNlcicpIHtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgb2JqZWN0LnBhc3N3b3JkID0gb2JqZWN0Ll9oYXNoZWRfcGFzc3dvcmQ7XG4gIGRlbGV0ZSBvYmplY3QuX2hhc2hlZF9wYXNzd29yZDtcblxuICBkZWxldGUgb2JqZWN0LnNlc3Npb25Ub2tlbjtcblxuICBpZiAoaXNNYXN0ZXIpIHtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG4gIGRlbGV0ZSBvYmplY3QuX2VtYWlsX3ZlcmlmeV90b2tlbjtcbiAgZGVsZXRlIG9iamVjdC5fcGVyaXNoYWJsZV90b2tlbjtcbiAgZGVsZXRlIG9iamVjdC5fcGVyaXNoYWJsZV90b2tlbl9leHBpcmVzX2F0O1xuICBkZWxldGUgb2JqZWN0Ll90b21ic3RvbmU7XG4gIGRlbGV0ZSBvYmplY3QuX2VtYWlsX3ZlcmlmeV90b2tlbl9leHBpcmVzX2F0O1xuICBkZWxldGUgb2JqZWN0Ll9mYWlsZWRfbG9naW5fY291bnQ7XG4gIGRlbGV0ZSBvYmplY3QuX2FjY291bnRfbG9ja291dF9leHBpcmVzX2F0O1xuICBkZWxldGUgb2JqZWN0Ll9wYXNzd29yZF9jaGFuZ2VkX2F0O1xuICBkZWxldGUgb2JqZWN0Ll9wYXNzd29yZF9oaXN0b3J5O1xuXG4gIGlmICgoYWNsR3JvdXAuaW5kZXhPZihvYmplY3Qub2JqZWN0SWQpID4gLTEpKSB7XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfVxuICBkZWxldGUgb2JqZWN0LmF1dGhEYXRhO1xuICByZXR1cm4gb2JqZWN0O1xufTtcblxuaW1wb3J0IHR5cGUgeyBMb2FkU2NoZW1hT3B0aW9ucyB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyBSdW5zIGFuIHVwZGF0ZSBvbiB0aGUgZGF0YWJhc2UuXG4vLyBSZXR1cm5zIGEgcHJvbWlzZSBmb3IgYW4gb2JqZWN0IHdpdGggdGhlIG5ldyB2YWx1ZXMgZm9yIGZpZWxkXG4vLyBtb2RpZmljYXRpb25zIHRoYXQgZG9uJ3Qga25vdyB0aGVpciByZXN1bHRzIGFoZWFkIG9mIHRpbWUsIGxpa2Vcbi8vICdpbmNyZW1lbnQnLlxuLy8gT3B0aW9uczpcbi8vICAgYWNsOiAgYSBsaXN0IG9mIHN0cmluZ3MuIElmIHRoZSBvYmplY3QgdG8gYmUgdXBkYXRlZCBoYXMgYW4gQUNMLFxuLy8gICAgICAgICBvbmUgb2YgdGhlIHByb3ZpZGVkIHN0cmluZ3MgbXVzdCBwcm92aWRlIHRoZSBjYWxsZXIgd2l0aFxuLy8gICAgICAgICB3cml0ZSBwZXJtaXNzaW9ucy5cbmNvbnN0IHNwZWNpYWxLZXlzRm9yVXBkYXRlID0gWydfaGFzaGVkX3Bhc3N3b3JkJywgJ19wZXJpc2hhYmxlX3Rva2VuJywgJ19lbWFpbF92ZXJpZnlfdG9rZW4nLCAnX2VtYWlsX3ZlcmlmeV90b2tlbl9leHBpcmVzX2F0JywgJ19hY2NvdW50X2xvY2tvdXRfZXhwaXJlc19hdCcsICdfZmFpbGVkX2xvZ2luX2NvdW50JywgJ19wZXJpc2hhYmxlX3Rva2VuX2V4cGlyZXNfYXQnLCAnX3Bhc3N3b3JkX2NoYW5nZWRfYXQnLCAnX3Bhc3N3b3JkX2hpc3RvcnknXTtcblxuY29uc3QgaXNTcGVjaWFsVXBkYXRlS2V5ID0ga2V5ID0+IHtcbiAgcmV0dXJuIHNwZWNpYWxLZXlzRm9yVXBkYXRlLmluZGV4T2Yoa2V5KSA+PSAwO1xufVxuXG5mdW5jdGlvbiBleHBhbmRSZXN1bHRPbktleVBhdGgob2JqZWN0LCBrZXksIHZhbHVlKSB7XG4gIGlmIChrZXkuaW5kZXhPZignLicpIDwgMCkge1xuICAgIG9iamVjdFtrZXldID0gdmFsdWVba2V5XTtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG4gIGNvbnN0IHBhdGggPSBrZXkuc3BsaXQoJy4nKTtcbiAgY29uc3QgZmlyc3RLZXkgPSBwYXRoWzBdO1xuICBjb25zdCBuZXh0UGF0aCA9IHBhdGguc2xpY2UoMSkuam9pbignLicpO1xuICBvYmplY3RbZmlyc3RLZXldID0gZXhwYW5kUmVzdWx0T25LZXlQYXRoKG9iamVjdFtmaXJzdEtleV0gfHwge30sIG5leHRQYXRoLCB2YWx1ZVtmaXJzdEtleV0pO1xuICBkZWxldGUgb2JqZWN0W2tleV07XG4gIHJldHVybiBvYmplY3Q7XG59XG5cbmZ1bmN0aW9uIHNhbml0aXplRGF0YWJhc2VSZXN1bHQob3JpZ2luYWxPYmplY3QsIHJlc3VsdCk6IFByb21pc2U8YW55PiB7XG4gIGNvbnN0IHJlc3BvbnNlID0ge307XG4gIGlmICghcmVzdWx0KSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXNwb25zZSk7XG4gIH1cbiAgT2JqZWN0LmtleXMob3JpZ2luYWxPYmplY3QpLmZvckVhY2goa2V5ID0+IHtcbiAgICBjb25zdCBrZXlVcGRhdGUgPSBvcmlnaW5hbE9iamVjdFtrZXldO1xuICAgIC8vIGRldGVybWluZSBpZiB0aGF0IHdhcyBhbiBvcFxuICAgIGlmIChrZXlVcGRhdGUgJiYgdHlwZW9mIGtleVVwZGF0ZSA9PT0gJ29iamVjdCcgJiYga2V5VXBkYXRlLl9fb3BcbiAgICAgICYmIFsnQWRkJywgJ0FkZFVuaXF1ZScsICdSZW1vdmUnLCAnSW5jcmVtZW50J10uaW5kZXhPZihrZXlVcGRhdGUuX19vcCkgPiAtMSkge1xuICAgICAgLy8gb25seSB2YWxpZCBvcHMgdGhhdCBwcm9kdWNlIGFuIGFjdGlvbmFibGUgcmVzdWx0XG4gICAgICAvLyB0aGUgb3AgbWF5IGhhdmUgaGFwcGVuZCBvbiBhIGtleXBhdGhcbiAgICAgIGV4cGFuZFJlc3VsdE9uS2V5UGF0aChyZXNwb25zZSwga2V5LCByZXN1bHQpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzcG9uc2UpO1xufVxuXG5mdW5jdGlvbiBqb2luVGFibGVOYW1lKGNsYXNzTmFtZSwga2V5KSB7XG4gIHJldHVybiBgX0pvaW46JHtrZXl9OiR7Y2xhc3NOYW1lfWA7XG59XG5cbmNvbnN0IGZsYXR0ZW5VcGRhdGVPcGVyYXRvcnNGb3JDcmVhdGUgPSBvYmplY3QgPT4ge1xuICBmb3IgKGNvbnN0IGtleSBpbiBvYmplY3QpIHtcbiAgICBpZiAob2JqZWN0W2tleV0gJiYgb2JqZWN0W2tleV0uX19vcCkge1xuICAgICAgc3dpdGNoIChvYmplY3Rba2V5XS5fX29wKSB7XG4gICAgICBjYXNlICdJbmNyZW1lbnQnOlxuICAgICAgICBpZiAodHlwZW9mIG9iamVjdFtrZXldLmFtb3VudCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCAnb2JqZWN0cyB0byBhZGQgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICB9XG4gICAgICAgIG9iamVjdFtrZXldID0gb2JqZWN0W2tleV0uYW1vdW50O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ0FkZCc6XG4gICAgICAgIGlmICghKG9iamVjdFtrZXldLm9iamVjdHMgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCAnb2JqZWN0cyB0byBhZGQgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICB9XG4gICAgICAgIG9iamVjdFtrZXldID0gb2JqZWN0W2tleV0ub2JqZWN0cztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdBZGRVbmlxdWUnOlxuICAgICAgICBpZiAoIShvYmplY3Rba2V5XS5vYmplY3RzIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgJ29iamVjdHMgdG8gYWRkIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgfVxuICAgICAgICBvYmplY3Rba2V5XSA9IG9iamVjdFtrZXldLm9iamVjdHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnUmVtb3ZlJzpcbiAgICAgICAgaWYgKCEob2JqZWN0W2tleV0ub2JqZWN0cyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sICdvYmplY3RzIHRvIGFkZCBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICAgIH1cbiAgICAgICAgb2JqZWN0W2tleV0gPSBbXVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ0RlbGV0ZSc6XG4gICAgICAgIGRlbGV0ZSBvYmplY3Rba2V5XTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuQ09NTUFORF9VTkFWQUlMQUJMRSwgYFRoZSAke29iamVjdFtrZXldLl9fb3B9IG9wZXJhdG9yIGlzIG5vdCBzdXBwb3J0ZWQgeWV0LmApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5jb25zdCB0cmFuc2Zvcm1BdXRoRGF0YSA9IChjbGFzc05hbWUsIG9iamVjdCwgc2NoZW1hKSA9PiB7XG4gIGlmIChvYmplY3QuYXV0aERhdGEgJiYgY2xhc3NOYW1lID09PSAnX1VzZXInKSB7XG4gICAgT2JqZWN0LmtleXMob2JqZWN0LmF1dGhEYXRhKS5mb3JFYWNoKHByb3ZpZGVyID0+IHtcbiAgICAgIGNvbnN0IHByb3ZpZGVyRGF0YSA9IG9iamVjdC5hdXRoRGF0YVtwcm92aWRlcl07XG4gICAgICBjb25zdCBmaWVsZE5hbWUgPSBgX2F1dGhfZGF0YV8ke3Byb3ZpZGVyfWA7XG4gICAgICBpZiAocHJvdmlkZXJEYXRhID09IG51bGwpIHtcbiAgICAgICAgb2JqZWN0W2ZpZWxkTmFtZV0gPSB7XG4gICAgICAgICAgX19vcDogJ0RlbGV0ZSdcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2JqZWN0W2ZpZWxkTmFtZV0gPSBwcm92aWRlckRhdGE7XG4gICAgICAgIHNjaGVtYS5maWVsZHNbZmllbGROYW1lXSA9IHsgdHlwZTogJ09iamVjdCcgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIGRlbGV0ZSBvYmplY3QuYXV0aERhdGE7XG4gIH1cbn1cbi8vIFRyYW5zZm9ybXMgYSBEYXRhYmFzZSBmb3JtYXQgQUNMIHRvIGEgUkVTVCBBUEkgZm9ybWF0IEFDTFxuY29uc3QgdW50cmFuc2Zvcm1PYmplY3RBQ0wgPSAoe19ycGVybSwgX3dwZXJtLCAuLi5vdXRwdXR9KSA9PiB7XG4gIGlmIChfcnBlcm0gfHwgX3dwZXJtKSB7XG4gICAgb3V0cHV0LkFDTCA9IHt9O1xuXG4gICAgKF9ycGVybSB8fCBbXSkuZm9yRWFjaChlbnRyeSA9PiB7XG4gICAgICBpZiAoIW91dHB1dC5BQ0xbZW50cnldKSB7XG4gICAgICAgIG91dHB1dC5BQ0xbZW50cnldID0geyByZWFkOiB0cnVlIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXQuQUNMW2VudHJ5XVsncmVhZCddID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIChfd3Blcm0gfHwgW10pLmZvckVhY2goZW50cnkgPT4ge1xuICAgICAgaWYgKCFvdXRwdXQuQUNMW2VudHJ5XSkge1xuICAgICAgICBvdXRwdXQuQUNMW2VudHJ5XSA9IHsgd3JpdGU6IHRydWUgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dC5BQ0xbZW50cnldWyd3cml0ZSddID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICByZXR1cm4gb3V0cHV0O1xufVxuXG4vKipcbiAqIFdoZW4gcXVlcnlpbmcsIHRoZSBmaWVsZE5hbWUgbWF5IGJlIGNvbXBvdW5kLCBleHRyYWN0IHRoZSByb290IGZpZWxkTmFtZVxuICogICAgIGB0ZW1wZXJhdHVyZS5jZWxzaXVzYCBiZWNvbWVzIGB0ZW1wZXJhdHVyZWBcbiAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZE5hbWUgdGhhdCBtYXkgYmUgYSBjb21wb3VuZCBmaWVsZCBuYW1lXG4gKiBAcmV0dXJucyB7c3RyaW5nfSB0aGUgcm9vdCBuYW1lIG9mIHRoZSBmaWVsZFxuICovXG5jb25zdCBnZXRSb290RmllbGROYW1lID0gKGZpZWxkTmFtZTogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgcmV0dXJuIGZpZWxkTmFtZS5zcGxpdCgnLicpWzBdXG59XG5cbmNvbnN0IHJlbGF0aW9uU2NoZW1hID0geyBmaWVsZHM6IHsgcmVsYXRlZElkOiB7IHR5cGU6ICdTdHJpbmcnIH0sIG93bmluZ0lkOiB7IHR5cGU6ICdTdHJpbmcnIH0gfSB9O1xuXG5jbGFzcyBEYXRhYmFzZUNvbnRyb2xsZXIge1xuICBhZGFwdGVyOiBTdG9yYWdlQWRhcHRlcjtcbiAgc2NoZW1hQ2FjaGU6IGFueTtcbiAgc2NoZW1hUHJvbWlzZTogP1Byb21pc2U8U2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyPjtcblxuICBjb25zdHJ1Y3RvcihhZGFwdGVyOiBTdG9yYWdlQWRhcHRlciwgc2NoZW1hQ2FjaGU6IGFueSkge1xuICAgIHRoaXMuYWRhcHRlciA9IGFkYXB0ZXI7XG4gICAgdGhpcy5zY2hlbWFDYWNoZSA9IHNjaGVtYUNhY2hlO1xuICAgIC8vIFdlIGRvbid0IHdhbnQgYSBtdXRhYmxlIHRoaXMuc2NoZW1hLCBiZWNhdXNlIHRoZW4geW91IGNvdWxkIGhhdmVcbiAgICAvLyBvbmUgcmVxdWVzdCB0aGF0IHVzZXMgZGlmZmVyZW50IHNjaGVtYXMgZm9yIGRpZmZlcmVudCBwYXJ0cyBvZlxuICAgIC8vIGl0LiBJbnN0ZWFkLCB1c2UgbG9hZFNjaGVtYSB0byBnZXQgYSBzY2hlbWEuXG4gICAgdGhpcy5zY2hlbWFQcm9taXNlID0gbnVsbDtcbiAgfVxuXG4gIGNvbGxlY3Rpb25FeGlzdHMoY2xhc3NOYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmNsYXNzRXhpc3RzKGNsYXNzTmFtZSk7XG4gIH1cblxuICBwdXJnZUNvbGxlY3Rpb24oY2xhc3NOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5sb2FkU2NoZW1hKClcbiAgICAgIC50aGVuKHNjaGVtYUNvbnRyb2xsZXIgPT4gc2NoZW1hQ29udHJvbGxlci5nZXRPbmVTY2hlbWEoY2xhc3NOYW1lKSlcbiAgICAgIC50aGVuKHNjaGVtYSA9PiB0aGlzLmFkYXB0ZXIuZGVsZXRlT2JqZWN0c0J5UXVlcnkoY2xhc3NOYW1lLCBzY2hlbWEsIHt9KSk7XG4gIH1cblxuICB2YWxpZGF0ZUNsYXNzTmFtZShjbGFzc05hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghU2NoZW1hQ29udHJvbGxlci5jbGFzc05hbWVJc1ZhbGlkKGNsYXNzTmFtZSkpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9DTEFTU19OQU1FLCAnaW52YWxpZCBjbGFzc05hbWU6ICcgKyBjbGFzc05hbWUpKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgZm9yIGEgc2NoZW1hQ29udHJvbGxlci5cbiAgbG9hZFNjaGVtYShvcHRpb25zOiBMb2FkU2NoZW1hT3B0aW9ucyA9IHtjbGVhckNhY2hlOiBmYWxzZX0pOiBQcm9taXNlPFNjaGVtYUNvbnRyb2xsZXIuU2NoZW1hQ29udHJvbGxlcj4ge1xuICAgIGlmICh0aGlzLnNjaGVtYVByb21pc2UgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMuc2NoZW1hUHJvbWlzZTtcbiAgICB9XG4gICAgdGhpcy5zY2hlbWFQcm9taXNlID0gU2NoZW1hQ29udHJvbGxlci5sb2FkKHRoaXMuYWRhcHRlciwgdGhpcy5zY2hlbWFDYWNoZSwgb3B0aW9ucyk7XG4gICAgdGhpcy5zY2hlbWFQcm9taXNlLnRoZW4oKCkgPT4gZGVsZXRlIHRoaXMuc2NoZW1hUHJvbWlzZSxcbiAgICAgICgpID0+IGRlbGV0ZSB0aGlzLnNjaGVtYVByb21pc2UpO1xuICAgIHJldHVybiB0aGlzLmxvYWRTY2hlbWEob3B0aW9ucyk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIGNsYXNzbmFtZSB0aGF0IGlzIHJlbGF0ZWQgdG8gdGhlIGdpdmVuXG4gIC8vIGNsYXNzbmFtZSB0aHJvdWdoIHRoZSBrZXkuXG4gIC8vIFRPRE86IG1ha2UgdGhpcyBub3QgaW4gdGhlIERhdGFiYXNlQ29udHJvbGxlciBpbnRlcmZhY2VcbiAgcmVkaXJlY3RDbGFzc05hbWVGb3JLZXkoY2xhc3NOYW1lOiBzdHJpbmcsIGtleTogc3RyaW5nKTogUHJvbWlzZTw/c3RyaW5nPiB7XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSgpLnRoZW4oKHNjaGVtYSkgPT4ge1xuICAgICAgdmFyIHQgID0gc2NoZW1hLmdldEV4cGVjdGVkVHlwZShjbGFzc05hbWUsIGtleSk7XG4gICAgICBpZiAodCAhPSBudWxsICYmIHR5cGVvZiB0ICE9PSAnc3RyaW5nJyAmJiB0LnR5cGUgPT09ICdSZWxhdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHQudGFyZ2V0Q2xhc3M7XG4gICAgICB9XG4gICAgICByZXR1cm4gY2xhc3NOYW1lO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gVXNlcyB0aGUgc2NoZW1hIHRvIHZhbGlkYXRlIHRoZSBvYmplY3QgKFJFU1QgQVBJIGZvcm1hdCkuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gdGhlIG5ldyBzY2hlbWEuXG4gIC8vIFRoaXMgZG9lcyBub3QgdXBkYXRlIHRoaXMuc2NoZW1hLCBiZWNhdXNlIGluIGEgc2l0dWF0aW9uIGxpa2UgYVxuICAvLyBiYXRjaCByZXF1ZXN0LCB0aGF0IGNvdWxkIGNvbmZ1c2Ugb3RoZXIgdXNlcnMgb2YgdGhlIHNjaGVtYS5cbiAgdmFsaWRhdGVPYmplY3QoY2xhc3NOYW1lOiBzdHJpbmcsIG9iamVjdDogYW55LCBxdWVyeTogYW55LCB7IGFjbCB9OiBRdWVyeU9wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBsZXQgc2NoZW1hO1xuICAgIGNvbnN0IGlzTWFzdGVyID0gYWNsID09PSB1bmRlZmluZWQ7XG4gICAgdmFyIGFjbEdyb3VwOiBzdHJpbmdbXSAgPSBhY2wgfHwgW107XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSgpLnRoZW4ocyA9PiB7XG4gICAgICBzY2hlbWEgPSBzO1xuICAgICAgaWYgKGlzTWFzdGVyKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNhbkFkZEZpZWxkKHNjaGVtYSwgY2xhc3NOYW1lLCBvYmplY3QsIGFjbEdyb3VwKTtcbiAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgIHJldHVybiBzY2hlbWEudmFsaWRhdGVPYmplY3QoY2xhc3NOYW1lLCBvYmplY3QsIHF1ZXJ5KTtcbiAgICB9KTtcbiAgfVxuXG4gIHVwZGF0ZShjbGFzc05hbWU6IHN0cmluZywgcXVlcnk6IGFueSwgdXBkYXRlOiBhbnksIHtcbiAgICBhY2wsXG4gICAgbWFueSxcbiAgICB1cHNlcnQsXG4gIH06IEZ1bGxRdWVyeU9wdGlvbnMgPSB7fSwgc2tpcFNhbml0aXphdGlvbjogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBvcmlnaW5hbFF1ZXJ5ID0gcXVlcnk7XG4gICAgY29uc3Qgb3JpZ2luYWxVcGRhdGUgPSB1cGRhdGU7XG4gICAgLy8gTWFrZSBhIGNvcHkgb2YgdGhlIG9iamVjdCwgc28gd2UgZG9uJ3QgbXV0YXRlIHRoZSBpbmNvbWluZyBkYXRhLlxuICAgIHVwZGF0ZSA9IGRlZXBjb3B5KHVwZGF0ZSk7XG4gICAgdmFyIHJlbGF0aW9uVXBkYXRlcyA9IFtdO1xuICAgIHZhciBpc01hc3RlciA9IGFjbCA9PT0gdW5kZWZpbmVkO1xuICAgIHZhciBhY2xHcm91cCA9IGFjbCB8fCBbXTtcbiAgICByZXR1cm4gdGhpcy5sb2FkU2NoZW1hKClcbiAgICAgIC50aGVuKHNjaGVtYUNvbnRyb2xsZXIgPT4ge1xuICAgICAgICByZXR1cm4gKGlzTWFzdGVyID8gUHJvbWlzZS5yZXNvbHZlKCkgOiBzY2hlbWFDb250cm9sbGVyLnZhbGlkYXRlUGVybWlzc2lvbihjbGFzc05hbWUsIGFjbEdyb3VwLCAndXBkYXRlJykpXG4gICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgcmVsYXRpb25VcGRhdGVzID0gdGhpcy5jb2xsZWN0UmVsYXRpb25VcGRhdGVzKGNsYXNzTmFtZSwgb3JpZ2luYWxRdWVyeS5vYmplY3RJZCwgdXBkYXRlKTtcbiAgICAgICAgICAgIGlmICghaXNNYXN0ZXIpIHtcbiAgICAgICAgICAgICAgcXVlcnkgPSB0aGlzLmFkZFBvaW50ZXJQZXJtaXNzaW9ucyhzY2hlbWFDb250cm9sbGVyLCBjbGFzc05hbWUsICd1cGRhdGUnLCBxdWVyeSwgYWNsR3JvdXApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFxdWVyeSkge1xuICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYWNsKSB7XG4gICAgICAgICAgICAgIHF1ZXJ5ID0gYWRkV3JpdGVBQ0wocXVlcnksIGFjbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YWxpZGF0ZVF1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgICAgIHJldHVybiBzY2hlbWFDb250cm9sbGVyLmdldE9uZVNjaGVtYShjbGFzc05hbWUsIHRydWUpXG4gICAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHNjaGVtYSBkb2Vzbid0IGV4aXN0LCBwcmV0ZW5kIGl0IGV4aXN0cyB3aXRoIG5vIGZpZWxkcy4gVGhpcyBiZWhhdmlvclxuICAgICAgICAgICAgICAgIC8vIHdpbGwgbGlrZWx5IG5lZWQgcmV2aXNpdGluZy5cbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZmllbGRzOiB7fSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgLnRoZW4oc2NoZW1hID0+IHtcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyh1cGRhdGUpLmZvckVhY2goZmllbGROYW1lID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmIChmaWVsZE5hbWUubWF0Y2goL15hdXRoRGF0YVxcLihbYS16QS1aMC05X10rKVxcLmlkJC8pKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLCBgSW52YWxpZCBmaWVsZCBuYW1lIGZvciB1cGRhdGU6ICR7ZmllbGROYW1lfWApO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgY29uc3Qgcm9vdEZpZWxkTmFtZSA9IGdldFJvb3RGaWVsZE5hbWUoZmllbGROYW1lKTtcbiAgICAgICAgICAgICAgICAgIGlmICghU2NoZW1hQ29udHJvbGxlci5maWVsZE5hbWVJc1ZhbGlkKHJvb3RGaWVsZE5hbWUpICYmICFpc1NwZWNpYWxVcGRhdGVLZXkocm9vdEZpZWxkTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfS0VZX05BTUUsIGBJbnZhbGlkIGZpZWxkIG5hbWUgZm9yIHVwZGF0ZTogJHtmaWVsZE5hbWV9YCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB1cGRhdGVPcGVyYXRpb24gaW4gdXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgICBpZiAodXBkYXRlW3VwZGF0ZU9wZXJhdGlvbl0gJiYgdHlwZW9mIHVwZGF0ZVt1cGRhdGVPcGVyYXRpb25dID09PSAnb2JqZWN0JyAmJiBPYmplY3Qua2V5cyh1cGRhdGVbdXBkYXRlT3BlcmF0aW9uXSkuc29tZShpbm5lcktleSA9PiBpbm5lcktleS5pbmNsdWRlcygnJCcpIHx8IGlubmVyS2V5LmluY2x1ZGVzKCcuJykpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX05FU1RFRF9LRVksIFwiTmVzdGVkIGtleXMgc2hvdWxkIG5vdCBjb250YWluIHRoZSAnJCcgb3IgJy4nIGNoYXJhY3RlcnNcIik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHVwZGF0ZSA9IHRyYW5zZm9ybU9iamVjdEFDTCh1cGRhdGUpO1xuICAgICAgICAgICAgICAgIHRyYW5zZm9ybUF1dGhEYXRhKGNsYXNzTmFtZSwgdXBkYXRlLCBzY2hlbWEpO1xuICAgICAgICAgICAgICAgIGlmIChtYW55KSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGFwdGVyLnVwZGF0ZU9iamVjdHNCeVF1ZXJ5KGNsYXNzTmFtZSwgc2NoZW1hLCBxdWVyeSwgdXBkYXRlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHVwc2VydCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci51cHNlcnRPbmVPYmplY3QoY2xhc3NOYW1lLCBzY2hlbWEsIHF1ZXJ5LCB1cGRhdGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmZpbmRPbmVBbmRVcGRhdGUoY2xhc3NOYW1lLCBzY2hlbWEsIHF1ZXJ5LCB1cGRhdGUpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC50aGVuKChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsICdPYmplY3Qgbm90IGZvdW5kLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUmVsYXRpb25VcGRhdGVzKGNsYXNzTmFtZSwgb3JpZ2luYWxRdWVyeS5vYmplY3RJZCwgdXBkYXRlLCByZWxhdGlvblVwZGF0ZXMpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSkudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBpZiAoc2tpcFNhbml0aXphdGlvbikge1xuICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc2FuaXRpemVEYXRhYmFzZVJlc3VsdChvcmlnaW5hbFVwZGF0ZSwgcmVzdWx0KTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLy8gQ29sbGVjdCBhbGwgcmVsYXRpb24tdXBkYXRpbmcgb3BlcmF0aW9ucyBmcm9tIGEgUkVTVC1mb3JtYXQgdXBkYXRlLlxuICAvLyBSZXR1cm5zIGEgbGlzdCBvZiBhbGwgcmVsYXRpb24gdXBkYXRlcyB0byBwZXJmb3JtXG4gIC8vIFRoaXMgbXV0YXRlcyB1cGRhdGUuXG4gIGNvbGxlY3RSZWxhdGlvblVwZGF0ZXMoY2xhc3NOYW1lOiBzdHJpbmcsIG9iamVjdElkOiA/c3RyaW5nLCB1cGRhdGU6IGFueSkge1xuICAgIHZhciBvcHMgPSBbXTtcbiAgICB2YXIgZGVsZXRlTWUgPSBbXTtcbiAgICBvYmplY3RJZCA9IHVwZGF0ZS5vYmplY3RJZCB8fCBvYmplY3RJZDtcblxuICAgIHZhciBwcm9jZXNzID0gKG9wLCBrZXkpID0+IHtcbiAgICAgIGlmICghb3ApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKG9wLl9fb3AgPT0gJ0FkZFJlbGF0aW9uJykge1xuICAgICAgICBvcHMucHVzaCh7a2V5LCBvcH0pO1xuICAgICAgICBkZWxldGVNZS5wdXNoKGtleSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcC5fX29wID09ICdSZW1vdmVSZWxhdGlvbicpIHtcbiAgICAgICAgb3BzLnB1c2goe2tleSwgb3B9KTtcbiAgICAgICAgZGVsZXRlTWUucHVzaChrZXkpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3AuX19vcCA9PSAnQmF0Y2gnKSB7XG4gICAgICAgIGZvciAodmFyIHggb2Ygb3Aub3BzKSB7XG4gICAgICAgICAgcHJvY2Vzcyh4LCBrZXkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIGZvciAoY29uc3Qga2V5IGluIHVwZGF0ZSkge1xuICAgICAgcHJvY2Vzcyh1cGRhdGVba2V5XSwga2V5KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBrZXkgb2YgZGVsZXRlTWUpIHtcbiAgICAgIGRlbGV0ZSB1cGRhdGVba2V5XTtcbiAgICB9XG4gICAgcmV0dXJuIG9wcztcbiAgfVxuXG4gIC8vIFByb2Nlc3NlcyByZWxhdGlvbi11cGRhdGluZyBvcGVyYXRpb25zIGZyb20gYSBSRVNULWZvcm1hdCB1cGRhdGUuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBhbGwgdXBkYXRlcyBoYXZlIGJlZW4gcGVyZm9ybWVkXG4gIGhhbmRsZVJlbGF0aW9uVXBkYXRlcyhjbGFzc05hbWU6IHN0cmluZywgb2JqZWN0SWQ6IHN0cmluZywgdXBkYXRlOiBhbnksIG9wczogYW55KSB7XG4gICAgdmFyIHBlbmRpbmcgPSBbXTtcbiAgICBvYmplY3RJZCA9IHVwZGF0ZS5vYmplY3RJZCB8fCBvYmplY3RJZDtcbiAgICBvcHMuZm9yRWFjaCgoe2tleSwgb3B9KSA9PiB7XG4gICAgICBpZiAoIW9wKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChvcC5fX29wID09ICdBZGRSZWxhdGlvbicpIHtcbiAgICAgICAgZm9yIChjb25zdCBvYmplY3Qgb2Ygb3Aub2JqZWN0cykge1xuICAgICAgICAgIHBlbmRpbmcucHVzaCh0aGlzLmFkZFJlbGF0aW9uKGtleSwgY2xhc3NOYW1lLFxuICAgICAgICAgICAgb2JqZWN0SWQsXG4gICAgICAgICAgICBvYmplY3Qub2JqZWN0SWQpKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAob3AuX19vcCA9PSAnUmVtb3ZlUmVsYXRpb24nKSB7XG4gICAgICAgIGZvciAoY29uc3Qgb2JqZWN0IG9mIG9wLm9iamVjdHMpIHtcbiAgICAgICAgICBwZW5kaW5nLnB1c2godGhpcy5yZW1vdmVSZWxhdGlvbihrZXksIGNsYXNzTmFtZSxcbiAgICAgICAgICAgIG9iamVjdElkLFxuICAgICAgICAgICAgb2JqZWN0Lm9iamVjdElkKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBQcm9taXNlLmFsbChwZW5kaW5nKTtcbiAgfVxuXG4gIC8vIEFkZHMgYSByZWxhdGlvbi5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyBzdWNjZXNzZnVsbHkgaWZmIHRoZSBhZGQgd2FzIHN1Y2Nlc3NmdWwuXG4gIGFkZFJlbGF0aW9uKGtleTogc3RyaW5nLCBmcm9tQ2xhc3NOYW1lOiBzdHJpbmcsIGZyb21JZDogc3RyaW5nLCB0b0lkOiBzdHJpbmcpIHtcbiAgICBjb25zdCBkb2MgPSB7XG4gICAgICByZWxhdGVkSWQ6IHRvSWQsXG4gICAgICBvd25pbmdJZDogZnJvbUlkXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyLnVwc2VydE9uZU9iamVjdChgX0pvaW46JHtrZXl9OiR7ZnJvbUNsYXNzTmFtZX1gLCByZWxhdGlvblNjaGVtYSwgZG9jLCBkb2MpO1xuICB9XG5cbiAgLy8gUmVtb3ZlcyBhIHJlbGF0aW9uLlxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHN1Y2Nlc3NmdWxseSBpZmYgdGhlIHJlbW92ZSB3YXNcbiAgLy8gc3VjY2Vzc2Z1bC5cbiAgcmVtb3ZlUmVsYXRpb24oa2V5OiBzdHJpbmcsIGZyb21DbGFzc05hbWU6IHN0cmluZywgZnJvbUlkOiBzdHJpbmcsIHRvSWQ6IHN0cmluZykge1xuICAgIHZhciBkb2MgPSB7XG4gICAgICByZWxhdGVkSWQ6IHRvSWQsXG4gICAgICBvd25pbmdJZDogZnJvbUlkXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmRlbGV0ZU9iamVjdHNCeVF1ZXJ5KGBfSm9pbjoke2tleX06JHtmcm9tQ2xhc3NOYW1lfWAsIHJlbGF0aW9uU2NoZW1hLCBkb2MpXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAvLyBXZSBkb24ndCBjYXJlIGlmIHRoZXkgdHJ5IHRvIGRlbGV0ZSBhIG5vbi1leGlzdGVudCByZWxhdGlvbi5cbiAgICAgICAgaWYgKGVycm9yLmNvZGUgPT0gUGFyc2UuRXJyb3IuT0JKRUNUX05PVF9GT1VORCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH0pO1xuICB9XG5cbiAgLy8gUmVtb3ZlcyBvYmplY3RzIG1hdGNoZXMgdGhpcyBxdWVyeSBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyBzdWNjZXNzZnVsbHkgaWZmIHRoZSBvYmplY3Qgd2FzXG4gIC8vIGRlbGV0ZWQuXG4gIC8vIE9wdGlvbnM6XG4gIC8vICAgYWNsOiAgYSBsaXN0IG9mIHN0cmluZ3MuIElmIHRoZSBvYmplY3QgdG8gYmUgdXBkYXRlZCBoYXMgYW4gQUNMLFxuICAvLyAgICAgICAgIG9uZSBvZiB0aGUgcHJvdmlkZWQgc3RyaW5ncyBtdXN0IHByb3ZpZGUgdGhlIGNhbGxlciB3aXRoXG4gIC8vICAgICAgICAgd3JpdGUgcGVybWlzc2lvbnMuXG4gIGRlc3Ryb3koY2xhc3NOYW1lOiBzdHJpbmcsIHF1ZXJ5OiBhbnksIHsgYWNsIH06IFF1ZXJ5T3B0aW9ucyA9IHt9KTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBpc01hc3RlciA9IGFjbCA9PT0gdW5kZWZpbmVkO1xuICAgIGNvbnN0IGFjbEdyb3VwID0gYWNsIHx8IFtdO1xuXG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSgpXG4gICAgICAudGhlbihzY2hlbWFDb250cm9sbGVyID0+IHtcbiAgICAgICAgcmV0dXJuIChpc01hc3RlciA/IFByb21pc2UucmVzb2x2ZSgpIDogc2NoZW1hQ29udHJvbGxlci52YWxpZGF0ZVBlcm1pc3Npb24oY2xhc3NOYW1lLCBhY2xHcm91cCwgJ2RlbGV0ZScpKVxuICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIGlmICghaXNNYXN0ZXIpIHtcbiAgICAgICAgICAgICAgcXVlcnkgPSB0aGlzLmFkZFBvaW50ZXJQZXJtaXNzaW9ucyhzY2hlbWFDb250cm9sbGVyLCBjbGFzc05hbWUsICdkZWxldGUnLCBxdWVyeSwgYWNsR3JvdXApO1xuICAgICAgICAgICAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsICdPYmplY3Qgbm90IGZvdW5kLicpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBkZWxldGUgYnkgcXVlcnlcbiAgICAgICAgICAgIGlmIChhY2wpIHtcbiAgICAgICAgICAgICAgcXVlcnkgPSBhZGRXcml0ZUFDTChxdWVyeSwgYWNsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhbGlkYXRlUXVlcnkocXVlcnkpO1xuICAgICAgICAgICAgcmV0dXJuIHNjaGVtYUNvbnRyb2xsZXIuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSlcbiAgICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlIHNjaGVtYSBkb2Vzbid0IGV4aXN0LCBwcmV0ZW5kIGl0IGV4aXN0cyB3aXRoIG5vIGZpZWxkcy4gVGhpcyBiZWhhdmlvclxuICAgICAgICAgICAgICAvLyB3aWxsIGxpa2VseSBuZWVkIHJldmlzaXRpbmcuXG4gICAgICAgICAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7IGZpZWxkczoge30gfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC50aGVuKHBhcnNlRm9ybWF0U2NoZW1hID0+IHRoaXMuYWRhcHRlci5kZWxldGVPYmplY3RzQnlRdWVyeShjbGFzc05hbWUsIHBhcnNlRm9ybWF0U2NoZW1hLCBxdWVyeSkpXG4gICAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgIC8vIFdoZW4gZGVsZXRpbmcgc2Vzc2lvbnMgd2hpbGUgY2hhbmdpbmcgcGFzc3dvcmRzLCBkb24ndCB0aHJvdyBhbiBlcnJvciBpZiB0aGV5IGRvbid0IGhhdmUgYW55IHNlc3Npb25zLlxuICAgICAgICAgICAgICAgIGlmIChjbGFzc05hbWUgPT09IFwiX1Nlc3Npb25cIiAmJiBlcnJvci5jb2RlID09PSBQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5EKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHt9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBJbnNlcnRzIGFuIG9iamVjdCBpbnRvIHRoZSBkYXRhYmFzZS5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyBzdWNjZXNzZnVsbHkgaWZmIHRoZSBvYmplY3Qgc2F2ZWQuXG4gIGNyZWF0ZShjbGFzc05hbWU6IHN0cmluZywgb2JqZWN0OiBhbnksIHsgYWNsIH06IFF1ZXJ5T3B0aW9ucyA9IHt9KTogUHJvbWlzZTxhbnk+IHtcbiAgLy8gTWFrZSBhIGNvcHkgb2YgdGhlIG9iamVjdCwgc28gd2UgZG9uJ3QgbXV0YXRlIHRoZSBpbmNvbWluZyBkYXRhLlxuICAgIGNvbnN0IG9yaWdpbmFsT2JqZWN0ID0gb2JqZWN0O1xuICAgIG9iamVjdCA9IHRyYW5zZm9ybU9iamVjdEFDTChvYmplY3QpO1xuXG4gICAgb2JqZWN0LmNyZWF0ZWRBdCA9IHsgaXNvOiBvYmplY3QuY3JlYXRlZEF0LCBfX3R5cGU6ICdEYXRlJyB9O1xuICAgIG9iamVjdC51cGRhdGVkQXQgPSB7IGlzbzogb2JqZWN0LnVwZGF0ZWRBdCwgX190eXBlOiAnRGF0ZScgfTtcblxuICAgIHZhciBpc01hc3RlciA9IGFjbCA9PT0gdW5kZWZpbmVkO1xuICAgIHZhciBhY2xHcm91cCA9IGFjbCB8fCBbXTtcbiAgICBjb25zdCByZWxhdGlvblVwZGF0ZXMgPSB0aGlzLmNvbGxlY3RSZWxhdGlvblVwZGF0ZXMoY2xhc3NOYW1lLCBudWxsLCBvYmplY3QpO1xuICAgIHJldHVybiB0aGlzLnZhbGlkYXRlQ2xhc3NOYW1lKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKCgpID0+IHRoaXMubG9hZFNjaGVtYSgpKVxuICAgICAgLnRoZW4oc2NoZW1hQ29udHJvbGxlciA9PiB7XG4gICAgICAgIHJldHVybiAoaXNNYXN0ZXIgPyBQcm9taXNlLnJlc29sdmUoKSA6IHNjaGVtYUNvbnRyb2xsZXIudmFsaWRhdGVQZXJtaXNzaW9uKGNsYXNzTmFtZSwgYWNsR3JvdXAsICdjcmVhdGUnKSlcbiAgICAgICAgICAudGhlbigoKSA9PiBzY2hlbWFDb250cm9sbGVyLmVuZm9yY2VDbGFzc0V4aXN0cyhjbGFzc05hbWUpKVxuICAgICAgICAgIC50aGVuKCgpID0+IHNjaGVtYUNvbnRyb2xsZXIucmVsb2FkRGF0YSgpKVxuICAgICAgICAgIC50aGVuKCgpID0+IHNjaGVtYUNvbnRyb2xsZXIuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSwgdHJ1ZSkpXG4gICAgICAgICAgLnRoZW4oc2NoZW1hID0+IHtcbiAgICAgICAgICAgIHRyYW5zZm9ybUF1dGhEYXRhKGNsYXNzTmFtZSwgb2JqZWN0LCBzY2hlbWEpO1xuICAgICAgICAgICAgZmxhdHRlblVwZGF0ZU9wZXJhdG9yc0ZvckNyZWF0ZShvYmplY3QpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci5jcmVhdGVPYmplY3QoY2xhc3NOYW1lLCBTY2hlbWFDb250cm9sbGVyLmNvbnZlcnRTY2hlbWFUb0FkYXB0ZXJTY2hlbWEoc2NoZW1hKSwgb2JqZWN0KTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC50aGVuKHJlc3VsdCA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVSZWxhdGlvblVwZGF0ZXMoY2xhc3NOYW1lLCBvYmplY3Qub2JqZWN0SWQsIG9iamVjdCwgcmVsYXRpb25VcGRhdGVzKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNhbml0aXplRGF0YWJhc2VSZXN1bHQob3JpZ2luYWxPYmplY3QsIHJlc3VsdC5vcHNbMF0pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pXG4gIH1cblxuICBjYW5BZGRGaWVsZChzY2hlbWE6IFNjaGVtYUNvbnRyb2xsZXIuU2NoZW1hQ29udHJvbGxlciwgY2xhc3NOYW1lOiBzdHJpbmcsIG9iamVjdDogYW55LCBhY2xHcm91cDogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjbGFzc1NjaGVtYSA9IHNjaGVtYS5kYXRhW2NsYXNzTmFtZV07XG4gICAgaWYgKCFjbGFzc1NjaGVtYSkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cbiAgICBjb25zdCBmaWVsZHMgPSBPYmplY3Qua2V5cyhvYmplY3QpO1xuICAgIGNvbnN0IHNjaGVtYUZpZWxkcyA9IE9iamVjdC5rZXlzKGNsYXNzU2NoZW1hKTtcbiAgICBjb25zdCBuZXdLZXlzID0gZmllbGRzLmZpbHRlcigoZmllbGQpID0+IHtcbiAgICAgIC8vIFNraXAgZmllbGRzIHRoYXQgYXJlIHVuc2V0XG4gICAgICBpZiAob2JqZWN0W2ZpZWxkXSAmJiBvYmplY3RbZmllbGRdLl9fb3AgJiYgb2JqZWN0W2ZpZWxkXS5fX29wID09PSAnRGVsZXRlJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2NoZW1hRmllbGRzLmluZGV4T2YoZmllbGQpIDwgMDtcbiAgICB9KTtcbiAgICBpZiAobmV3S2V5cy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gc2NoZW1hLnZhbGlkYXRlUGVybWlzc2lvbihjbGFzc05hbWUsIGFjbEdyb3VwLCAnYWRkRmllbGQnKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgLy8gV29uJ3QgZGVsZXRlIGNvbGxlY3Rpb25zIGluIHRoZSBzeXN0ZW0gbmFtZXNwYWNlXG4gIC8qKlxuICAgKiBEZWxldGUgYWxsIGNsYXNzZXMgYW5kIGNsZWFycyB0aGUgc2NoZW1hIGNhY2hlXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gZmFzdCBzZXQgdG8gdHJ1ZSBpZiBpdCdzIG9rIHRvIGp1c3QgZGVsZXRlIHJvd3MgYW5kIG5vdCBpbmRleGVzXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fSB3aGVuIHRoZSBkZWxldGlvbnMgY29tcGxldGVzXG4gICAqL1xuICBkZWxldGVFdmVyeXRoaW5nKGZhc3Q6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8YW55PiB7XG4gICAgdGhpcy5zY2hlbWFQcm9taXNlID0gbnVsbDtcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoW1xuICAgICAgdGhpcy5hZGFwdGVyLmRlbGV0ZUFsbENsYXNzZXMoZmFzdCksXG4gICAgICB0aGlzLnNjaGVtYUNhY2hlLmNsZWFyKClcbiAgICBdKTtcbiAgfVxuXG5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgZm9yIGEgbGlzdCBvZiByZWxhdGVkIGlkcyBnaXZlbiBhbiBvd25pbmcgaWQuXG4gIC8vIGNsYXNzTmFtZSBoZXJlIGlzIHRoZSBvd25pbmcgY2xhc3NOYW1lLlxuICByZWxhdGVkSWRzKGNsYXNzTmFtZTogc3RyaW5nLCBrZXk6IHN0cmluZywgb3duaW5nSWQ6IHN0cmluZywgcXVlcnlPcHRpb25zOiBRdWVyeU9wdGlvbnMpOiBQcm9taXNlPEFycmF5PHN0cmluZz4+IHtcbiAgICBjb25zdCB7IHNraXAsIGxpbWl0LCBzb3J0IH0gPSBxdWVyeU9wdGlvbnM7XG4gICAgY29uc3QgZmluZE9wdGlvbnMgPSB7fTtcbiAgICBpZiAoc29ydCAmJiBzb3J0LmNyZWF0ZWRBdCAmJiB0aGlzLmFkYXB0ZXIuY2FuU29ydE9uSm9pblRhYmxlcykge1xuICAgICAgZmluZE9wdGlvbnMuc29ydCA9IHsgJ19pZCcgOiBzb3J0LmNyZWF0ZWRBdCB9O1xuICAgICAgZmluZE9wdGlvbnMubGltaXQgPSBsaW1pdDtcbiAgICAgIGZpbmRPcHRpb25zLnNraXAgPSBza2lwO1xuICAgICAgcXVlcnlPcHRpb25zLnNraXAgPSAwO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmZpbmQoam9pblRhYmxlTmFtZShjbGFzc05hbWUsIGtleSksIHJlbGF0aW9uU2NoZW1hLCB7IG93bmluZ0lkIH0sIGZpbmRPcHRpb25zKVxuICAgICAgLnRoZW4ocmVzdWx0cyA9PiByZXN1bHRzLm1hcChyZXN1bHQgPT4gcmVzdWx0LnJlbGF0ZWRJZCkpO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgZm9yIGEgbGlzdCBvZiBvd25pbmcgaWRzIGdpdmVuIHNvbWUgcmVsYXRlZCBpZHMuXG4gIC8vIGNsYXNzTmFtZSBoZXJlIGlzIHRoZSBvd25pbmcgY2xhc3NOYW1lLlxuICBvd25pbmdJZHMoY2xhc3NOYW1lOiBzdHJpbmcsIGtleTogc3RyaW5nLCByZWxhdGVkSWRzOiBzdHJpbmdbXSk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmZpbmQoam9pblRhYmxlTmFtZShjbGFzc05hbWUsIGtleSksIHJlbGF0aW9uU2NoZW1hLCB7IHJlbGF0ZWRJZDogeyAnJGluJzogcmVsYXRlZElkcyB9IH0sIHt9KVxuICAgICAgLnRoZW4ocmVzdWx0cyA9PiByZXN1bHRzLm1hcChyZXN1bHQgPT4gcmVzdWx0Lm93bmluZ0lkKSk7XG4gIH1cblxuICAvLyBNb2RpZmllcyBxdWVyeSBzbyB0aGF0IGl0IG5vIGxvbmdlciBoYXMgJGluIG9uIHJlbGF0aW9uIGZpZWxkcywgb3JcbiAgLy8gZXF1YWwtdG8tcG9pbnRlciBjb25zdHJhaW50cyBvbiByZWxhdGlvbiBmaWVsZHMuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBxdWVyeSBpcyBtdXRhdGVkXG4gIHJlZHVjZUluUmVsYXRpb24oY2xhc3NOYW1lOiBzdHJpbmcsIHF1ZXJ5OiBhbnksIHNjaGVtYTogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgLy8gU2VhcmNoIGZvciBhbiBpbi1yZWxhdGlvbiBvciBlcXVhbC10by1yZWxhdGlvblxuICAvLyBNYWtlIGl0IHNlcXVlbnRpYWwgZm9yIG5vdywgbm90IHN1cmUgb2YgcGFyYWxsZWl6YXRpb24gc2lkZSBlZmZlY3RzXG4gICAgaWYgKHF1ZXJ5Wyckb3InXSkge1xuICAgICAgY29uc3Qgb3JzID0gcXVlcnlbJyRvciddO1xuICAgICAgcmV0dXJuIFByb21pc2UuYWxsKG9ycy5tYXAoKGFRdWVyeSwgaW5kZXgpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVkdWNlSW5SZWxhdGlvbihjbGFzc05hbWUsIGFRdWVyeSwgc2NoZW1hKS50aGVuKChhUXVlcnkpID0+IHtcbiAgICAgICAgICBxdWVyeVsnJG9yJ11baW5kZXhdID0gYVF1ZXJ5O1xuICAgICAgICB9KTtcbiAgICAgIH0pKS50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShxdWVyeSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBwcm9taXNlcyA9IE9iamVjdC5rZXlzKHF1ZXJ5KS5tYXAoKGtleSkgPT4ge1xuICAgICAgY29uc3QgdCA9IHNjaGVtYS5nZXRFeHBlY3RlZFR5cGUoY2xhc3NOYW1lLCBrZXkpO1xuICAgICAgaWYgKCF0IHx8IHQudHlwZSAhPT0gJ1JlbGF0aW9uJykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHF1ZXJ5KTtcbiAgICAgIH1cbiAgICAgIGxldCBxdWVyaWVzOiA/YW55W10gPSBudWxsO1xuICAgICAgaWYgKHF1ZXJ5W2tleV0gJiYgKHF1ZXJ5W2tleV1bJyRpbiddIHx8IHF1ZXJ5W2tleV1bJyRuZSddIHx8IHF1ZXJ5W2tleV1bJyRuaW4nXSB8fCBxdWVyeVtrZXldLl9fdHlwZSA9PSAnUG9pbnRlcicpKSB7XG4gICAgICAvLyBCdWlsZCB0aGUgbGlzdCBvZiBxdWVyaWVzXG4gICAgICAgIHF1ZXJpZXMgPSBPYmplY3Qua2V5cyhxdWVyeVtrZXldKS5tYXAoKGNvbnN0cmFpbnRLZXkpID0+IHtcbiAgICAgICAgICBsZXQgcmVsYXRlZElkcztcbiAgICAgICAgICBsZXQgaXNOZWdhdGlvbiA9IGZhbHNlO1xuICAgICAgICAgIGlmIChjb25zdHJhaW50S2V5ID09PSAnb2JqZWN0SWQnKSB7XG4gICAgICAgICAgICByZWxhdGVkSWRzID0gW3F1ZXJ5W2tleV0ub2JqZWN0SWRdO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY29uc3RyYWludEtleSA9PSAnJGluJykge1xuICAgICAgICAgICAgcmVsYXRlZElkcyA9IHF1ZXJ5W2tleV1bJyRpbiddLm1hcChyID0+IHIub2JqZWN0SWQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY29uc3RyYWludEtleSA9PSAnJG5pbicpIHtcbiAgICAgICAgICAgIGlzTmVnYXRpb24gPSB0cnVlO1xuICAgICAgICAgICAgcmVsYXRlZElkcyA9IHF1ZXJ5W2tleV1bJyRuaW4nXS5tYXAociA9PiByLm9iamVjdElkKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNvbnN0cmFpbnRLZXkgPT0gJyRuZScpIHtcbiAgICAgICAgICAgIGlzTmVnYXRpb24gPSB0cnVlO1xuICAgICAgICAgICAgcmVsYXRlZElkcyA9IFtxdWVyeVtrZXldWyckbmUnXS5vYmplY3RJZF07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlzTmVnYXRpb24sXG4gICAgICAgICAgICByZWxhdGVkSWRzXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXJpZXMgPSBbe2lzTmVnYXRpb246IGZhbHNlLCByZWxhdGVkSWRzOiBbXX1dO1xuICAgICAgfVxuXG4gICAgICAvLyByZW1vdmUgdGhlIGN1cnJlbnQgcXVlcnlLZXkgYXMgd2UgZG9uLHQgbmVlZCBpdCBhbnltb3JlXG4gICAgICBkZWxldGUgcXVlcnlba2V5XTtcbiAgICAgIC8vIGV4ZWN1dGUgZWFjaCBxdWVyeSBpbmRlcGVuZGVudGx5IHRvIGJ1aWxkIHRoZSBsaXN0IG9mXG4gICAgICAvLyAkaW4gLyAkbmluXG4gICAgICBjb25zdCBwcm9taXNlcyA9IHF1ZXJpZXMubWFwKChxKSA9PiB7XG4gICAgICAgIGlmICghcSkge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5vd25pbmdJZHMoY2xhc3NOYW1lLCBrZXksIHEucmVsYXRlZElkcykudGhlbigoaWRzKSA9PiB7XG4gICAgICAgICAgaWYgKHEuaXNOZWdhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5hZGROb3RJbk9iamVjdElkc0lkcyhpZHMsIHF1ZXJ5KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5hZGRJbk9iamVjdElkc0lkcyhpZHMsIHF1ZXJ5KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICB9KVxuXG4gICAgfSlcblxuICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbigoKSA9PiB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHF1ZXJ5KTtcbiAgICB9KVxuICB9XG5cbiAgLy8gTW9kaWZpZXMgcXVlcnkgc28gdGhhdCBpdCBubyBsb25nZXIgaGFzICRyZWxhdGVkVG9cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHF1ZXJ5IGlzIG11dGF0ZWRcbiAgcmVkdWNlUmVsYXRpb25LZXlzKGNsYXNzTmFtZTogc3RyaW5nLCBxdWVyeTogYW55LCBxdWVyeU9wdGlvbnM6IGFueSk6ID9Qcm9taXNlPHZvaWQ+IHtcblxuICAgIGlmIChxdWVyeVsnJG9yJ10pIHtcbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChxdWVyeVsnJG9yJ10ubWFwKChhUXVlcnkpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVkdWNlUmVsYXRpb25LZXlzKGNsYXNzTmFtZSwgYVF1ZXJ5LCBxdWVyeU9wdGlvbnMpO1xuICAgICAgfSkpO1xuICAgIH1cblxuICAgIHZhciByZWxhdGVkVG8gPSBxdWVyeVsnJHJlbGF0ZWRUbyddO1xuICAgIGlmIChyZWxhdGVkVG8pIHtcbiAgICAgIHJldHVybiB0aGlzLnJlbGF0ZWRJZHMoXG4gICAgICAgIHJlbGF0ZWRUby5vYmplY3QuY2xhc3NOYW1lLFxuICAgICAgICByZWxhdGVkVG8ua2V5LFxuICAgICAgICByZWxhdGVkVG8ub2JqZWN0Lm9iamVjdElkLFxuICAgICAgICBxdWVyeU9wdGlvbnMpXG4gICAgICAgIC50aGVuKChpZHMpID0+IHtcbiAgICAgICAgICBkZWxldGUgcXVlcnlbJyRyZWxhdGVkVG8nXTtcbiAgICAgICAgICB0aGlzLmFkZEluT2JqZWN0SWRzSWRzKGlkcywgcXVlcnkpO1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlZHVjZVJlbGF0aW9uS2V5cyhjbGFzc05hbWUsIHF1ZXJ5LCBxdWVyeU9wdGlvbnMpO1xuICAgICAgICB9KS50aGVuKCgpID0+IHt9KTtcbiAgICB9XG4gIH1cblxuICBhZGRJbk9iamVjdElkc0lkcyhpZHM6ID9BcnJheTxzdHJpbmc+ID0gbnVsbCwgcXVlcnk6IGFueSkge1xuICAgIGNvbnN0IGlkc0Zyb21TdHJpbmc6ID9BcnJheTxzdHJpbmc+ID0gdHlwZW9mIHF1ZXJ5Lm9iamVjdElkID09PSAnc3RyaW5nJyA/IFtxdWVyeS5vYmplY3RJZF0gOiBudWxsO1xuICAgIGNvbnN0IGlkc0Zyb21FcTogP0FycmF5PHN0cmluZz4gPSBxdWVyeS5vYmplY3RJZCAmJiBxdWVyeS5vYmplY3RJZFsnJGVxJ10gPyBbcXVlcnkub2JqZWN0SWRbJyRlcSddXSA6IG51bGw7XG4gICAgY29uc3QgaWRzRnJvbUluOiA/QXJyYXk8c3RyaW5nPiA9IHF1ZXJ5Lm9iamVjdElkICYmIHF1ZXJ5Lm9iamVjdElkWyckaW4nXSA/IHF1ZXJ5Lm9iamVjdElkWyckaW4nXSA6IG51bGw7XG5cbiAgICAvLyBAZmxvdy1kaXNhYmxlLW5leHRcbiAgICBjb25zdCBhbGxJZHM6IEFycmF5PEFycmF5PHN0cmluZz4+ID0gW2lkc0Zyb21TdHJpbmcsIGlkc0Zyb21FcSwgaWRzRnJvbUluLCBpZHNdLmZpbHRlcihsaXN0ID0+IGxpc3QgIT09IG51bGwpO1xuICAgIGNvbnN0IHRvdGFsTGVuZ3RoID0gYWxsSWRzLnJlZHVjZSgobWVtbywgbGlzdCkgPT4gbWVtbyArIGxpc3QubGVuZ3RoLCAwKTtcblxuICAgIGxldCBpZHNJbnRlcnNlY3Rpb24gPSBbXTtcbiAgICBpZiAodG90YWxMZW5ndGggPiAxMjUpIHtcbiAgICAgIGlkc0ludGVyc2VjdGlvbiA9IGludGVyc2VjdC5iaWcoYWxsSWRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWRzSW50ZXJzZWN0aW9uID0gaW50ZXJzZWN0KGFsbElkcyk7XG4gICAgfVxuXG4gICAgLy8gTmVlZCB0byBtYWtlIHN1cmUgd2UgZG9uJ3QgY2xvYmJlciBleGlzdGluZyBzaG9ydGhhbmQgJGVxIGNvbnN0cmFpbnRzIG9uIG9iamVjdElkLlxuICAgIGlmICghKCdvYmplY3RJZCcgaW4gcXVlcnkpKSB7XG4gICAgICBxdWVyeS5vYmplY3RJZCA9IHtcbiAgICAgICAgJGluOiB1bmRlZmluZWQsXG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHF1ZXJ5Lm9iamVjdElkID09PSAnc3RyaW5nJykge1xuICAgICAgcXVlcnkub2JqZWN0SWQgPSB7XG4gICAgICAgICRpbjogdW5kZWZpbmVkLFxuICAgICAgICAkZXE6IHF1ZXJ5Lm9iamVjdElkXG4gICAgICB9O1xuICAgIH1cbiAgICBxdWVyeS5vYmplY3RJZFsnJGluJ10gPSBpZHNJbnRlcnNlY3Rpb247XG5cbiAgICByZXR1cm4gcXVlcnk7XG4gIH1cblxuICBhZGROb3RJbk9iamVjdElkc0lkcyhpZHM6IHN0cmluZ1tdID0gW10sIHF1ZXJ5OiBhbnkpIHtcbiAgICBjb25zdCBpZHNGcm9tTmluID0gcXVlcnkub2JqZWN0SWQgJiYgcXVlcnkub2JqZWN0SWRbJyRuaW4nXSA/IHF1ZXJ5Lm9iamVjdElkWyckbmluJ10gOiBbXTtcbiAgICBsZXQgYWxsSWRzID0gWy4uLmlkc0Zyb21OaW4sLi4uaWRzXS5maWx0ZXIobGlzdCA9PiBsaXN0ICE9PSBudWxsKTtcblxuICAgIC8vIG1ha2UgYSBzZXQgYW5kIHNwcmVhZCB0byByZW1vdmUgZHVwbGljYXRlc1xuICAgIGFsbElkcyA9IFsuLi5uZXcgU2V0KGFsbElkcyldO1xuXG4gICAgLy8gTmVlZCB0byBtYWtlIHN1cmUgd2UgZG9uJ3QgY2xvYmJlciBleGlzdGluZyBzaG9ydGhhbmQgJGVxIGNvbnN0cmFpbnRzIG9uIG9iamVjdElkLlxuICAgIGlmICghKCdvYmplY3RJZCcgaW4gcXVlcnkpKSB7XG4gICAgICBxdWVyeS5vYmplY3RJZCA9IHtcbiAgICAgICAgJG5pbjogdW5kZWZpbmVkLFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBxdWVyeS5vYmplY3RJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHF1ZXJ5Lm9iamVjdElkID0ge1xuICAgICAgICAkbmluOiB1bmRlZmluZWQsXG4gICAgICAgICRlcTogcXVlcnkub2JqZWN0SWRcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcXVlcnkub2JqZWN0SWRbJyRuaW4nXSA9IGFsbElkcztcbiAgICByZXR1cm4gcXVlcnk7XG4gIH1cblxuICAvLyBSdW5zIGEgcXVlcnkgb24gdGhlIGRhdGFiYXNlLlxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGEgbGlzdCBvZiBpdGVtcy5cbiAgLy8gT3B0aW9uczpcbiAgLy8gICBza2lwICAgIG51bWJlciBvZiByZXN1bHRzIHRvIHNraXAuXG4gIC8vICAgbGltaXQgICBsaW1pdCB0byB0aGlzIG51bWJlciBvZiByZXN1bHRzLlxuICAvLyAgIHNvcnQgICAgYW4gb2JqZWN0IHdoZXJlIGtleXMgYXJlIHRoZSBmaWVsZHMgdG8gc29ydCBieS5cbiAgLy8gICAgICAgICAgIHRoZSB2YWx1ZSBpcyArMSBmb3IgYXNjZW5kaW5nLCAtMSBmb3IgZGVzY2VuZGluZy5cbiAgLy8gICBjb3VudCAgIHJ1biBhIGNvdW50IGluc3RlYWQgb2YgcmV0dXJuaW5nIHJlc3VsdHMuXG4gIC8vICAgYWNsICAgICByZXN0cmljdCB0aGlzIG9wZXJhdGlvbiB3aXRoIGFuIEFDTCBmb3IgdGhlIHByb3ZpZGVkIGFycmF5XG4gIC8vICAgICAgICAgICBvZiB1c2VyIG9iamVjdElkcyBhbmQgcm9sZXMuIGFjbDogbnVsbCBtZWFucyBubyB1c2VyLlxuICAvLyAgICAgICAgICAgd2hlbiB0aGlzIGZpZWxkIGlzIG5vdCBwcmVzZW50LCBkb24ndCBkbyBhbnl0aGluZyByZWdhcmRpbmcgQUNMcy5cbiAgLy8gVE9ETzogbWFrZSB1c2VySWRzIG5vdCBuZWVkZWQgaGVyZS4gVGhlIGRiIGFkYXB0ZXIgc2hvdWxkbid0IGtub3dcbiAgLy8gYW55dGhpbmcgYWJvdXQgdXNlcnMsIGlkZWFsbHkuIFRoZW4sIGltcHJvdmUgdGhlIGZvcm1hdCBvZiB0aGUgQUNMXG4gIC8vIGFyZyB0byB3b3JrIGxpa2UgdGhlIG90aGVycy5cbiAgZmluZChjbGFzc05hbWU6IHN0cmluZywgcXVlcnk6IGFueSwge1xuICAgIHNraXAsXG4gICAgbGltaXQsXG4gICAgYWNsLFxuICAgIHNvcnQgPSB7fSxcbiAgICBjb3VudCxcbiAgICBrZXlzLFxuICAgIG9wLFxuICAgIGRpc3RpbmN0LFxuICAgIHBpcGVsaW5lLFxuICAgIHJlYWRQcmVmZXJlbmNlLFxuICAgIGlzV3JpdGUsXG4gIH06IGFueSA9IHt9KTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBpc01hc3RlciA9IGFjbCA9PT0gdW5kZWZpbmVkO1xuICAgIGNvbnN0IGFjbEdyb3VwID0gYWNsIHx8IFtdO1xuICAgIG9wID0gb3AgfHwgKHR5cGVvZiBxdWVyeS5vYmplY3RJZCA9PSAnc3RyaW5nJyAmJiBPYmplY3Qua2V5cyhxdWVyeSkubGVuZ3RoID09PSAxID8gJ2dldCcgOiAnZmluZCcpO1xuICAgIC8vIENvdW50IG9wZXJhdGlvbiBpZiBjb3VudGluZ1xuICAgIG9wID0gKGNvdW50ID09PSB0cnVlID8gJ2NvdW50JyA6IG9wKTtcblxuICAgIGxldCBjbGFzc0V4aXN0cyA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSgpXG4gICAgICAudGhlbihzY2hlbWFDb250cm9sbGVyID0+IHtcbiAgICAgICAgLy9BbGxvdyB2b2xhdGlsZSBjbGFzc2VzIGlmIHF1ZXJ5aW5nIHdpdGggTWFzdGVyIChmb3IgX1B1c2hTdGF0dXMpXG4gICAgICAgIC8vVE9ETzogTW92ZSB2b2xhdGlsZSBjbGFzc2VzIGNvbmNlcHQgaW50byBtb25nbyBhZGFwdGVyLCBwb3N0Z3JlcyBhZGFwdGVyIHNob3VsZG4ndCBjYXJlXG4gICAgICAgIC8vdGhhdCBhcGkucGFyc2UuY29tIGJyZWFrcyB3aGVuIF9QdXNoU3RhdHVzIGV4aXN0cyBpbiBtb25nby5cbiAgICAgICAgcmV0dXJuIHNjaGVtYUNvbnRyb2xsZXIuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSwgaXNNYXN0ZXIpXG4gICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAvLyBCZWhhdmlvciBmb3Igbm9uLWV4aXN0ZW50IGNsYXNzZXMgaXMga2luZGEgd2VpcmQgb24gUGFyc2UuY29tLiBQcm9iYWJseSBkb2Vzbid0IG1hdHRlciB0b28gbXVjaC5cbiAgICAgICAgICAvLyBGb3Igbm93LCBwcmV0ZW5kIHRoZSBjbGFzcyBleGlzdHMgYnV0IGhhcyBubyBvYmplY3RzLFxuICAgICAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY2xhc3NFeGlzdHMgPSBmYWxzZTtcbiAgICAgICAgICAgICAgcmV0dXJuIHsgZmllbGRzOiB7fSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAudGhlbihzY2hlbWEgPT4ge1xuICAgICAgICAgIC8vIFBhcnNlLmNvbSB0cmVhdHMgcXVlcmllcyBvbiBfY3JlYXRlZF9hdCBhbmQgX3VwZGF0ZWRfYXQgYXMgaWYgdGhleSB3ZXJlIHF1ZXJpZXMgb24gY3JlYXRlZEF0IGFuZCB1cGRhdGVkQXQsXG4gICAgICAgICAgLy8gc28gZHVwbGljYXRlIHRoYXQgYmVoYXZpb3IgaGVyZS4gSWYgYm90aCBhcmUgc3BlY2lmaWVkLCB0aGUgY29ycmVjdCBiZWhhdmlvciB0byBtYXRjaCBQYXJzZS5jb20gaXMgdG9cbiAgICAgICAgICAvLyB1c2UgdGhlIG9uZSB0aGF0IGFwcGVhcnMgZmlyc3QgaW4gdGhlIHNvcnQgbGlzdC5cbiAgICAgICAgICAgIGlmIChzb3J0Ll9jcmVhdGVkX2F0KSB7XG4gICAgICAgICAgICAgIHNvcnQuY3JlYXRlZEF0ID0gc29ydC5fY3JlYXRlZF9hdDtcbiAgICAgICAgICAgICAgZGVsZXRlIHNvcnQuX2NyZWF0ZWRfYXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc29ydC5fdXBkYXRlZF9hdCkge1xuICAgICAgICAgICAgICBzb3J0LnVwZGF0ZWRBdCA9IHNvcnQuX3VwZGF0ZWRfYXQ7XG4gICAgICAgICAgICAgIGRlbGV0ZSBzb3J0Ll91cGRhdGVkX2F0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcXVlcnlPcHRpb25zID0geyBza2lwLCBsaW1pdCwgc29ydCwga2V5cywgcmVhZFByZWZlcmVuY2UgfTtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHNvcnQpLmZvckVhY2goZmllbGROYW1lID0+IHtcbiAgICAgICAgICAgICAgaWYgKGZpZWxkTmFtZS5tYXRjaCgvXmF1dGhEYXRhXFwuKFthLXpBLVowLTlfXSspXFwuaWQkLykpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9LRVlfTkFNRSwgYENhbm5vdCBzb3J0IGJ5ICR7ZmllbGROYW1lfWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IHJvb3RGaWVsZE5hbWUgPSBnZXRSb290RmllbGROYW1lKGZpZWxkTmFtZSk7XG4gICAgICAgICAgICAgIGlmICghU2NoZW1hQ29udHJvbGxlci5maWVsZE5hbWVJc1ZhbGlkKHJvb3RGaWVsZE5hbWUpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfS0VZX05BTUUsIGBJbnZhbGlkIGZpZWxkIG5hbWU6ICR7ZmllbGROYW1lfS5gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKGlzTWFzdGVyID8gUHJvbWlzZS5yZXNvbHZlKCkgOiBzY2hlbWFDb250cm9sbGVyLnZhbGlkYXRlUGVybWlzc2lvbihjbGFzc05hbWUsIGFjbEdyb3VwLCBvcCkpXG4gICAgICAgICAgICAgIC50aGVuKCgpID0+IHRoaXMucmVkdWNlUmVsYXRpb25LZXlzKGNsYXNzTmFtZSwgcXVlcnksIHF1ZXJ5T3B0aW9ucykpXG4gICAgICAgICAgICAgIC50aGVuKCgpID0+IHRoaXMucmVkdWNlSW5SZWxhdGlvbihjbGFzc05hbWUsIHF1ZXJ5LCBzY2hlbWFDb250cm9sbGVyKSlcbiAgICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghaXNNYXN0ZXIpIHtcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5ID0gdGhpcy5hZGRQb2ludGVyUGVybWlzc2lvbnMoc2NoZW1hQ29udHJvbGxlciwgY2xhc3NOYW1lLCBvcCwgcXVlcnksIGFjbEdyb3VwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFxdWVyeSkge1xuICAgICAgICAgICAgICAgICAgaWYgKG9wID09ICdnZXQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnT2JqZWN0IG5vdCBmb3VuZC4nKTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFpc01hc3Rlcikge1xuICAgICAgICAgICAgICAgICAgaWYgKGlzV3JpdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcXVlcnkgPSBhZGRXcml0ZUFDTChxdWVyeSwgYWNsR3JvdXApO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcXVlcnkgPSBhZGRSZWFkQUNMKHF1ZXJ5LCBhY2xHcm91cCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhbGlkYXRlUXVlcnkocXVlcnkpO1xuICAgICAgICAgICAgICAgIGlmIChjb3VudCkge1xuICAgICAgICAgICAgICAgICAgaWYgKCFjbGFzc0V4aXN0cykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuY291bnQoY2xhc3NOYW1lLCBzY2hlbWEsIHF1ZXJ5LCByZWFkUHJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSAgZWxzZSBpZiAoZGlzdGluY3QpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghY2xhc3NFeGlzdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci5kaXN0aW5jdChjbGFzc05hbWUsIHNjaGVtYSwgcXVlcnksIGRpc3RpbmN0KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9ICBlbHNlIGlmIChwaXBlbGluZSkge1xuICAgICAgICAgICAgICAgICAgaWYgKCFjbGFzc0V4aXN0cykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmFnZ3JlZ2F0ZShjbGFzc05hbWUsIHNjaGVtYSwgcGlwZWxpbmUsIHJlYWRQcmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci5maW5kKGNsYXNzTmFtZSwgc2NoZW1hLCBxdWVyeSwgcXVlcnlPcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAudGhlbihvYmplY3RzID0+IG9iamVjdHMubWFwKG9iamVjdCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgb2JqZWN0ID0gdW50cmFuc2Zvcm1PYmplY3RBQ0wob2JqZWN0KTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmlsdGVyU2Vuc2l0aXZlRGF0YShpc01hc3RlciwgYWNsR3JvdXAsIGNsYXNzTmFtZSwgb2JqZWN0KVxuICAgICAgICAgICAgICAgICAgICB9KSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVEVSTkFMX1NFUlZFUl9FUlJPUiwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG4gIH1cblxuICBkZWxldGVTY2hlbWEoY2xhc3NOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5sb2FkU2NoZW1hKHsgY2xlYXJDYWNoZTogdHJ1ZSB9KVxuICAgICAgLnRoZW4oc2NoZW1hQ29udHJvbGxlciA9PiBzY2hlbWFDb250cm9sbGVyLmdldE9uZVNjaGVtYShjbGFzc05hbWUsIHRydWUpKVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4geyBmaWVsZHM6IHt9IH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAudGhlbigoc2NoZW1hOiBhbnkpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbkV4aXN0cyhjbGFzc05hbWUpXG4gICAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5hZGFwdGVyLmNvdW50KGNsYXNzTmFtZSwgeyBmaWVsZHM6IHt9IH0pKVxuICAgICAgICAgIC50aGVuKGNvdW50ID0+IHtcbiAgICAgICAgICAgIGlmIChjb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKDI1NSwgYENsYXNzICR7Y2xhc3NOYW1lfSBpcyBub3QgZW1wdHksIGNvbnRhaW5zICR7Y291bnR9IG9iamVjdHMsIGNhbm5vdCBkcm9wIHNjaGVtYS5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZGVsZXRlQ2xhc3MoY2xhc3NOYW1lKTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC50aGVuKHdhc1BhcnNlQ29sbGVjdGlvbiA9PiB7XG4gICAgICAgICAgICBpZiAod2FzUGFyc2VDb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlbGF0aW9uRmllbGROYW1lcyA9IE9iamVjdC5rZXlzKHNjaGVtYS5maWVsZHMpLmZpbHRlcihmaWVsZE5hbWUgPT4gc2NoZW1hLmZpZWxkc1tmaWVsZE5hbWVdLnR5cGUgPT09ICdSZWxhdGlvbicpO1xuICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwocmVsYXRpb25GaWVsZE5hbWVzLm1hcChuYW1lID0+IHRoaXMuYWRhcHRlci5kZWxldGVDbGFzcyhqb2luVGFibGVOYW1lKGNsYXNzTmFtZSwgbmFtZSkpKSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgIH0pXG4gIH1cblxuICBhZGRQb2ludGVyUGVybWlzc2lvbnMoc2NoZW1hOiBhbnksIGNsYXNzTmFtZTogc3RyaW5nLCBvcGVyYXRpb246IHN0cmluZywgcXVlcnk6IGFueSwgYWNsR3JvdXA6IGFueVtdID0gW10pIHtcbiAgLy8gQ2hlY2sgaWYgY2xhc3MgaGFzIHB1YmxpYyBwZXJtaXNzaW9uIGZvciBvcGVyYXRpb25cbiAgLy8gSWYgdGhlIEJhc2VDTFAgcGFzcywgbGV0IGdvIHRocm91Z2hcbiAgICBpZiAoc2NoZW1hLnRlc3RCYXNlQ0xQKGNsYXNzTmFtZSwgYWNsR3JvdXAsIG9wZXJhdGlvbikpIHtcbiAgICAgIHJldHVybiBxdWVyeTtcbiAgICB9XG4gICAgY29uc3QgcGVybXMgPSBzY2hlbWEucGVybXNbY2xhc3NOYW1lXTtcbiAgICBjb25zdCBmaWVsZCA9IFsnZ2V0JywgJ2ZpbmQnXS5pbmRleE9mKG9wZXJhdGlvbikgPiAtMSA/ICdyZWFkVXNlckZpZWxkcycgOiAnd3JpdGVVc2VyRmllbGRzJztcbiAgICBjb25zdCB1c2VyQUNMID0gYWNsR3JvdXAuZmlsdGVyKChhY2wpID0+IHtcbiAgICAgIHJldHVybiBhY2wuaW5kZXhPZigncm9sZTonKSAhPSAwICYmIGFjbCAhPSAnKic7XG4gICAgfSk7XG4gICAgLy8gdGhlIEFDTCBzaG91bGQgaGF2ZSBleGFjdGx5IDEgdXNlclxuICAgIGlmIChwZXJtcyAmJiBwZXJtc1tmaWVsZF0gJiYgcGVybXNbZmllbGRdLmxlbmd0aCA+IDApIHtcbiAgICAvLyBObyB1c2VyIHNldCByZXR1cm4gdW5kZWZpbmVkXG4gICAgLy8gSWYgdGhlIGxlbmd0aCBpcyA+IDEsIHRoYXQgbWVhbnMgd2UgZGlkbid0IGRlLWR1cGUgdXNlcnMgY29ycmVjdGx5XG4gICAgICBpZiAodXNlckFDTC5sZW5ndGggIT0gMSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCB1c2VySWQgPSB1c2VyQUNMWzBdO1xuICAgICAgY29uc3QgdXNlclBvaW50ZXIgPSAge1xuICAgICAgICBcIl9fdHlwZVwiOiBcIlBvaW50ZXJcIixcbiAgICAgICAgXCJjbGFzc05hbWVcIjogXCJfVXNlclwiLFxuICAgICAgICBcIm9iamVjdElkXCI6IHVzZXJJZFxuICAgICAgfTtcblxuICAgICAgY29uc3QgcGVybUZpZWxkcyA9IHBlcm1zW2ZpZWxkXTtcbiAgICAgIGNvbnN0IG9ycyA9IHBlcm1GaWVsZHMubWFwKChrZXkpID0+IHtcbiAgICAgICAgY29uc3QgcSA9IHtcbiAgICAgICAgICBba2V5XTogdXNlclBvaW50ZXJcbiAgICAgICAgfTtcbiAgICAgICAgLy8gaWYgd2UgYWxyZWFkeSBoYXZlIGEgY29uc3RyYWludCBvbiB0aGUga2V5LCB1c2UgdGhlICRhbmRcbiAgICAgICAgaWYgKHF1ZXJ5Lmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICByZXR1cm4geyckYW5kJzogW3EsIHF1ZXJ5XX07XG4gICAgICAgIH1cbiAgICAgICAgLy8gb3RoZXJ3aXNlIGp1c3QgYWRkIHRoZSBjb25zdGFpbnRcbiAgICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHF1ZXJ5LCB7XG4gICAgICAgICAgW2Ake2tleX1gXTogdXNlclBvaW50ZXIsXG4gICAgICAgIH0pXG4gICAgICB9KTtcbiAgICAgIGlmIChvcnMubGVuZ3RoID4gMSkge1xuICAgICAgICByZXR1cm4geyckb3InOiBvcnN9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIG9yc1swXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHF1ZXJ5O1xuICAgIH1cbiAgfVxuXG4gIC8vIFRPRE86IGNyZWF0ZSBpbmRleGVzIG9uIGZpcnN0IGNyZWF0aW9uIG9mIGEgX1VzZXIgb2JqZWN0LiBPdGhlcndpc2UgaXQncyBpbXBvc3NpYmxlIHRvXG4gIC8vIGhhdmUgYSBQYXJzZSBhcHAgd2l0aG91dCBpdCBoYXZpbmcgYSBfVXNlciBjb2xsZWN0aW9uLlxuICBwZXJmb3JtSW5pdGlhbGl6YXRpb24oKSB7XG4gICAgY29uc3QgcmVxdWlyZWRVc2VyRmllbGRzID0geyBmaWVsZHM6IHsgLi4uU2NoZW1hQ29udHJvbGxlci5kZWZhdWx0Q29sdW1ucy5fRGVmYXVsdCwgLi4uU2NoZW1hQ29udHJvbGxlci5kZWZhdWx0Q29sdW1ucy5fVXNlciB9IH07XG4gICAgY29uc3QgcmVxdWlyZWRSb2xlRmllbGRzID0geyBmaWVsZHM6IHsgLi4uU2NoZW1hQ29udHJvbGxlci5kZWZhdWx0Q29sdW1ucy5fRGVmYXVsdCwgLi4uU2NoZW1hQ29udHJvbGxlci5kZWZhdWx0Q29sdW1ucy5fUm9sZSB9IH07XG5cbiAgICAgICAgY29uc3QgcHVibGljdXNlciA9IHtcbiAgICAgIGZpZWxkczogeyAuLi5TY2hlbWFDb250cm9sbGVyLmRlZmF1bHRDb2x1bW5zLl9EZWZhdWx0LFxuICAgICAgICAuLi5TY2hlbWFDb250cm9sbGVyLmRlZmF1bHRDb2x1bW5zLl9QdWJsaWNVc2VyXG4gICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBwcml2YXRlcmVjb3JkID0ge1xuICAgICAgZmllbGRzOiB7IC4uLlNjaGVtYUNvbnRyb2xsZXIuZGVmYXVsdENvbHVtbnMuX0RlZmF1bHQsXG4gICAgICAgIC4uLlNjaGVtYUNvbnRyb2xsZXIuZGVmYXVsdENvbHVtbnMuX1ByaXZhdGVSZWNvcmRcbiAgICAgIH1cbiAgICB9O1xuICAgIGNvbnN0IHJlY29yZHMgPSB7XG4gICAgICBmaWVsZHM6IHsgLi4uU2NoZW1hQ29udHJvbGxlci5kZWZhdWx0Q29sdW1ucy5fRGVmYXVsdCxcbiAgICAgICAgLi4uU2NoZW1hQ29udHJvbGxlci5kZWZhdWx0Q29sdW1ucy5fUmVjb3Jkc1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCB1c2VyQ2xhc3NQcm9taXNlID0gdGhpcy5sb2FkU2NoZW1hKClcbiAgICAgIC50aGVuKHNjaGVtYSA9PiBzY2hlbWEuZW5mb3JjZUNsYXNzRXhpc3RzKCdfVXNlcicpKVxuICAgIGNvbnN0IHJvbGVDbGFzc1Byb21pc2UgPSB0aGlzLmxvYWRTY2hlbWEoKVxuICAgICAgLnRoZW4oc2NoZW1hID0+IHNjaGVtYS5lbmZvcmNlQ2xhc3NFeGlzdHMoJ19Sb2xlJykpXG5cblxuXG4gICAgICAgICAgY29uc3QgcHVibGljdXNlclByb21pc2UgPSB0aGlzLmxvYWRTY2hlbWEoKVxuICAgICAgLnRoZW4oc2NoZW1hID0+IHNjaGVtYS5lbmZvcmNlQ2xhc3NFeGlzdHMoJ1B1YmxpY1VzZXInKSlcbiAgICBjb25zdCBwcml2YXRlcmVjb3JkUHJvbWlzZSA9IHRoaXMubG9hZFNjaGVtYSgpXG4gICAgICAudGhlbihzY2hlbWEgPT4gc2NoZW1hLmVuZm9yY2VDbGFzc0V4aXN0cygnUHJpdmF0ZVJlY29yZCcpKVxuICAgIGNvbnN0IHJlY29yZHNQcm9taXNlID0gdGhpcy5sb2FkU2NoZW1hKClcbiAgICAgIC50aGVuKHNjaGVtYSA9PiBzY2hlbWEuZW5mb3JjZUNsYXNzRXhpc3RzKCdSZWNvcmRzJykpXG5cblxuXG5cblxuICAgIGNvbnN0IHVzZXJuYW1lVW5pcXVlbmVzcyA9IHVzZXJDbGFzc1Byb21pc2VcbiAgICAgIC50aGVuKCgpID0+IHRoaXMuYWRhcHRlci5lbnN1cmVVbmlxdWVuZXNzKCdfVXNlcicsIHJlcXVpcmVkVXNlckZpZWxkcywgWyd1c2VybmFtZSddKSlcbiAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgIGxvZ2dlci53YXJuKCdVbmFibGUgdG8gZW5zdXJlIHVuaXF1ZW5lc3MgZm9yIHVzZXJuYW1lczogJywgZXJyb3IpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH0pO1xuXG4gICAgY29uc3QgZW1haWxVbmlxdWVuZXNzID0gdXNlckNsYXNzUHJvbWlzZVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5hZGFwdGVyLmVuc3VyZVVuaXF1ZW5lc3MoJ19Vc2VyJywgcmVxdWlyZWRVc2VyRmllbGRzLCBbJ2VtYWlsJ10pKVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgbG9nZ2VyLndhcm4oJ1VuYWJsZSB0byBlbnN1cmUgdW5pcXVlbmVzcyBmb3IgdXNlciBlbWFpbCBhZGRyZXNzZXM6ICcsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9KTtcblxuICAgIGNvbnN0IHJvbGVVbmlxdWVuZXNzID0gcm9sZUNsYXNzUHJvbWlzZVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5hZGFwdGVyLmVuc3VyZVVuaXF1ZW5lc3MoJ19Sb2xlJywgcmVxdWlyZWRSb2xlRmllbGRzLCBbJ25hbWUnXSkpXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBsb2dnZXIud2FybignVW5hYmxlIHRvIGVuc3VyZSB1bmlxdWVuZXNzIGZvciByb2xlIG5hbWU6ICcsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9KTtcblxuXG5cblxuICAgIGNvbnN0IHB1YmxpY3VzZXJVbmlxdWVuZXNzID0gcHVibGljdXNlclByb21pc2VcbiAgICAgIC50aGVuKCgpID0+IHRoaXMuYWRhcHRlci5lbnN1cmVVbmlxdWVuZXNzKCdQdWJsaWNVc2VyJywgcHVibGljdXNlciwgWydvYmplY3RJZCddKSlcbiAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgIGxvZ2dlci53YXJuKCdVbmFibGUgdG8gZW5zdXJlIHVuaXF1ZW5lc3MgZm9yIHB1YmxpY3VzZXI6ICcsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9KTtcbiAgICBjb25zdCBwcml2YXRlcmVjb3JkVW5pcXVlbmVzcyA9IHByaXZhdGVyZWNvcmRQcm9taXNlXG4gICAgICAudGhlbigoKSA9PiB0aGlzLmFkYXB0ZXIuZW5zdXJlVW5pcXVlbmVzcygnUHJpdmF0ZVJlY29yZCcsIHByaXZhdGVyZWNvcmQsIFsnb2JqZWN0SWQnXSkpXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBsb2dnZXIud2FybignVW5hYmxlIHRvIGVuc3VyZSB1bmlxdWVuZXNzIGZvciBwcml2YXRlIHJlY29yZDogJywgZXJyb3IpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH0pO1xuICAgIGNvbnN0IHJlY29yZHNVbmlxdWVuZXNzID0gcmVjb3Jkc1Byb21pc2VcbiAgICAgIC50aGVuKCgpID0+IHRoaXMuYWRhcHRlci5lbnN1cmVVbmlxdWVuZXNzKCdSZWNvcmRzJywgcmVjb3JkcywgWydvYmplY3RJZCddKSlcbiAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgIGxvZ2dlci53YXJuKCdVbmFibGUgdG8gZW5zdXJlIHVuaXF1ZW5lc3MgZm9yIHJlY29yZHM6ICcsIGVycm9yKTtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9KTtcblxuXG5cblxuXG5cblxuICAgIGNvbnN0IGluZGV4UHJvbWlzZSA9IHRoaXMuYWRhcHRlci51cGRhdGVTY2hlbWFXaXRoSW5kZXhlcygpO1xuXG4gICAgLy8gQ3JlYXRlIHRhYmxlcyBmb3Igdm9sYXRpbGUgY2xhc3Nlc1xuICAgIGNvbnN0IGFkYXB0ZXJJbml0ID0gdGhpcy5hZGFwdGVyLnBlcmZvcm1Jbml0aWFsaXphdGlvbih7IFZvbGF0aWxlQ2xhc3Nlc1NjaGVtYXM6IFNjaGVtYUNvbnRyb2xsZXIuVm9sYXRpbGVDbGFzc2VzU2NoZW1hcyB9KTtcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoW3VzZXJuYW1lVW5pcXVlbmVzcywgcHVibGljdXNlclVuaXF1ZW5lc3MsIHJlY29yZHNVbmlxdWVuZXNzLCBwcml2YXRlcmVjb3JkVW5pcXVlbmVzcywgZW1haWxVbmlxdWVuZXNzLCByb2xlVW5pcXVlbmVzcywgYWRhcHRlckluaXQsIGluZGV4UHJvbWlzZV0pO1xuICB9XG5cbiAgc3RhdGljIF92YWxpZGF0ZVF1ZXJ5OiAoKGFueSkgPT4gdm9pZClcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBEYXRhYmFzZUNvbnRyb2xsZXI7XG4vLyBFeHBvc2UgdmFsaWRhdGVRdWVyeSBmb3IgdGVzdHNcbm1vZHVsZS5leHBvcnRzLl92YWxpZGF0ZVF1ZXJ5ID0gdmFsaWRhdGVRdWVyeTsiXX0=