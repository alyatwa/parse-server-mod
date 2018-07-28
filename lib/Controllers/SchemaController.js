'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SchemaController = exports.VolatileClassesSchemas = exports.convertSchemaToAdapterSchema = exports.defaultColumns = exports.systemClasses = exports.buildMergedSchemaObject = exports.invalidClassNameMessage = exports.fieldNameIsValid = exports.classNameIsValid = exports.load = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _StorageAdapter = require('../Adapters/Storage/StorageAdapter');

var _DatabaseController = require('./DatabaseController');

var _DatabaseController2 = _interopRequireDefault(_DatabaseController);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

// This class handles schema validation, persistence, and modification.
//
// Each individual Schema object should be immutable. The helpers to
// do things with the Schema just return a new schema when the schema
// is changed.
//
// The canonical place to store this Schema is in the database itself,
// in a _SCHEMA collection. This is not the right way to do it for an
// open source framework, but it's backward compatible, so we're
// keeping it this way for now.
//
// In API-handling code, you should only use the Schema class via the
// DatabaseController. This will let us replace the schema logic for
// different databases.
// TODO: hide all schema logic inside the database adapter.
// -disable-next
const Parse = require('parse/node').Parse;


const defaultColumns = Object.freeze({
  // Contain the default columns for every parse object type (except _Join collection)
  _Default: {
    "objectId": { type: 'String' },
    "createdAt": { type: 'Date' },
    "updatedAt": { type: 'Date' },
    "ACL": { type: 'ACL' }
  },
  // The additional default columns for the _User collection (in addition to DefaultCols)
  _User: {
    "username": { type: 'String' },
    "password": { type: 'String' },
    "img": { type: 'String' },
    "ip": { type: 'String' },
    "country": { type: 'String' },
    "img": { type: 'File' },
    "FCM": { type: 'String' },
    "email": { type: 'String' },
    "emailVerified": { type: 'Boolean' },
    "authData": { type: 'Object' },
    "new": { type: 'Number' }
  },

  _PrivateRecord: {
    "recordId": { type: 'String' },
    "sender": { type: 'String' },
    "file": { type: 'File' },
    "receiverId": { type: 'String' }
  },

  _PublicUser: {
    "username": { type: 'String' },
    "userId": { type: 'String' },
    "img": { type: 'File' }
  },

  _Records: {
    "receiverID": { type: 'String' },
    "receiver": { type: 'String' },
    "file": { type: 'File' }
  },

  // The additional default columns for the _Installation collection (in addition to DefaultCols)
  _Installation: {
    "installationId": { type: 'String' },
    "deviceToken": { type: 'String' },
    "channels": { type: 'Array' },
    "deviceType": { type: 'String' },
    "pushType": { type: 'String' },
    "GCMSenderId": { type: 'String' },
    "timeZone": { type: 'String' },
    "localeIdentifier": { type: 'String' },
    "badge": { type: 'Number' },
    "appVersion": { type: 'String' },
    "appName": { type: 'String' },
    "appIdentifier": { type: 'String' },
    "parseVersion": { type: 'String' }
  },
  // The additional default columns for the _Role collection (in addition to DefaultCols)
  _Role: {
    "name": { type: 'String' },
    "users": { type: 'Relation', targetClass: '_User' },
    "roles": { type: 'Relation', targetClass: '_Role' }
  },
  // The additional default columns for the _Session collection (in addition to DefaultCols)
  _Session: {
    "restricted": { type: 'Boolean' },
    "user": { type: 'Pointer', targetClass: '_User' },
    "installationId": { type: 'String' },
    "sessionToken": { type: 'String' },
    "expiresAt": { type: 'Date' },
    "createdWith": { type: 'Object' }
  },
  _Product: {
    "productIdentifier": { type: 'String' },
    "download": { type: 'File' },
    "downloadName": { type: 'String' },
    "icon": { type: 'File' },
    "order": { type: 'Number' },
    "title": { type: 'String' },
    "subtitle": { type: 'String' }
  },
  _PushStatus: {
    "pushTime": { type: 'String' },
    "source": { type: 'String' }, // rest or webui
    "query": { type: 'String' }, // the stringified JSON query
    "payload": { type: 'String' }, // the stringified JSON payload,
    "title": { type: 'String' },
    "expiry": { type: 'Number' },
    "expiration_interval": { type: 'Number' },
    "status": { type: 'String' },
    "numSent": { type: 'Number' },
    "numFailed": { type: 'Number' },
    "pushHash": { type: 'String' },
    "errorMessage": { type: 'Object' },
    "sentPerType": { type: 'Object' },
    "failedPerType": { type: 'Object' },
    "sentPerUTCOffset": { type: 'Object' },
    "failedPerUTCOffset": { type: 'Object' },
    "count": { type: 'Number' // tracks # of batches queued and pending
    } },
  _JobStatus: {
    "jobName": { type: 'String' },
    "source": { type: 'String' },
    "status": { type: 'String' },
    "message": { type: 'String' },
    "params": { type: 'Object' }, // params received when calling the job
    "finishedAt": { type: 'Date' }
  },
  _JobSchedule: {
    "jobName": { type: 'String' },
    "description": { type: 'String' },
    "params": { type: 'String' },
    "startAfter": { type: 'String' },
    "daysOfWeek": { type: 'Array' },
    "timeOfDay": { type: 'String' },
    "lastRun": { type: 'Number' },
    "repeatMinutes": { type: 'Number' }
  },
  _Hooks: {
    "functionName": { type: 'String' },
    "className": { type: 'String' },
    "triggerName": { type: 'String' },
    "url": { type: 'String' }
  },
  _GlobalConfig: {
    "objectId": { type: 'String' },
    "params": { type: 'Object' }
  },
  _Audience: {
    "objectId": { type: 'String' },
    "name": { type: 'String' },
    "query": { type: 'String' }, //storing query as JSON string to prevent "Nested keys should not contain the '$' or '.' characters" error
    "lastUsed": { type: 'Date' },
    "timesUsed": { type: 'Number' }
  }
});

const requiredColumns = Object.freeze({
  _Product: ["productIdentifier", "icon", "order", "title", "subtitle"],
  _Role: ["name", "ACL"]
});

const systemClasses = Object.freeze(['_User', '_PublicUser', '_Records', '_PrivateRecord', '_Installation', '_Role', '_Session', '_Product', '_PushStatus', '_JobStatus', '_JobSchedule', '_Audience']);

const volatileClasses = Object.freeze(['_JobStatus', '_PushStatus', '_Hooks', '_GlobalConfig', '_JobSchedule', '_Audience']);

// 10 alpha numberic chars + uppercase
const userIdRegex = /^[a-zA-Z0-9]{10}$/;
// Anything that start with role
const roleRegex = /^role:.*/;
// * permission
const publicRegex = /^\*$/;

const requireAuthenticationRegex = /^requiresAuthentication$/;

const permissionKeyRegex = Object.freeze([userIdRegex, roleRegex, publicRegex, requireAuthenticationRegex]);

function verifyPermissionKey(key) {
  const result = permissionKeyRegex.reduce((isGood, regEx) => {
    isGood = isGood || key.match(regEx) != null;
    return isGood;
  }, false);
  if (!result) {
    throw new Parse.Error(Parse.Error.INVALID_JSON, `'${key}' is not a valid key for class level permissions`);
  }
}

const CLPValidKeys = Object.freeze(['find', 'count', 'get', 'create', 'update', 'delete', 'addField', 'readUserFields', 'writeUserFields']);
function validateCLP(perms, fields) {
  if (!perms) {
    return;
  }
  Object.keys(perms).forEach(operation => {
    if (CLPValidKeys.indexOf(operation) == -1) {
      throw new Parse.Error(Parse.Error.INVALID_JSON, `${operation} is not a valid operation for class level permissions`);
    }
    if (!perms[operation]) {
      return;
    }

    if (operation === 'readUserFields' || operation === 'writeUserFields') {
      if (!Array.isArray(perms[operation])) {
        // -disable-next
        throw new Parse.Error(Parse.Error.INVALID_JSON, `'${perms[operation]}' is not a valid value for class level permissions ${operation}`);
      } else {
        perms[operation].forEach(key => {
          if (!fields[key] || fields[key].type != 'Pointer' || fields[key].targetClass != '_User') {
            throw new Parse.Error(Parse.Error.INVALID_JSON, `'${key}' is not a valid column for class level pointer permissions ${operation}`);
          }
        });
      }
      return;
    }

    // -disable-next
    Object.keys(perms[operation]).forEach(key => {
      verifyPermissionKey(key);
      // -disable-next
      const perm = perms[operation][key];
      if (perm !== true) {
        // -disable-next
        throw new Parse.Error(Parse.Error.INVALID_JSON, `'${perm}' is not a valid value for class level permissions ${operation}:${key}:${perm}`);
      }
    });
  });
}
const joinClassRegex = /^_Join:[A-Za-z0-9_]+:[A-Za-z0-9_]+/;
const classAndFieldRegex = /^[A-Za-z][A-Za-z0-9_]*$/;
function classNameIsValid(className) {
  // Valid classes must:
  return (
    // Be one of _User, _Installation, _Role, _Session OR
    systemClasses.indexOf(className) > -1 ||
    // Be a join table OR
    joinClassRegex.test(className) ||
    // Include only alpha-numeric and underscores, and not start with an underscore or number
    fieldNameIsValid(className)
  );
}

// Valid fields must be alpha-numeric, and not start with an underscore or number
function fieldNameIsValid(fieldName) {
  return classAndFieldRegex.test(fieldName);
}

// Checks that it's not trying to clobber one of the default fields of the class.
function fieldNameIsValidForClass(fieldName, className) {
  if (!fieldNameIsValid(fieldName)) {
    return false;
  }
  if (defaultColumns._Default[fieldName]) {
    return false;
  }
  if (defaultColumns[className] && defaultColumns[className][fieldName]) {
    return false;
  }
  return true;
}

function invalidClassNameMessage(className) {
  return 'Invalid classname: ' + className + ', classnames can only have alphanumeric characters and _, and must start with an alpha character ';
}

const invalidJsonError = new Parse.Error(Parse.Error.INVALID_JSON, "invalid JSON");
const validNonRelationOrPointerTypes = ['Number', 'String', 'Boolean', 'Date', 'Object', 'Array', 'GeoPoint', 'File', 'Bytes', 'Polygon'];
// Returns an error suitable for throwing if the type is invalid
const fieldTypeIsInvalid = ({ type, targetClass }) => {
  if (['Pointer', 'Relation'].indexOf(type) >= 0) {
    if (!targetClass) {
      return new Parse.Error(135, `type ${type} needs a class name`);
    } else if (typeof targetClass !== 'string') {
      return invalidJsonError;
    } else if (!classNameIsValid(targetClass)) {
      return new Parse.Error(Parse.Error.INVALID_CLASS_NAME, invalidClassNameMessage(targetClass));
    } else {
      return undefined;
    }
  }
  if (typeof type !== 'string') {
    return invalidJsonError;
  }
  if (validNonRelationOrPointerTypes.indexOf(type) < 0) {
    return new Parse.Error(Parse.Error.INCORRECT_TYPE, `invalid field type: ${type}`);
  }
  return undefined;
};

const convertSchemaToAdapterSchema = schema => {
  schema = injectDefaultSchema(schema);
  delete schema.fields.ACL;
  schema.fields._rperm = { type: 'Array' };
  schema.fields._wperm = { type: 'Array' };

  if (schema.className === '_User') {
    delete schema.fields.password;
    schema.fields._hashed_password = { type: 'String' };
  }

  return schema;
};

const convertAdapterSchemaToParseSchema = (_ref) => {
  let schema = _objectWithoutProperties(_ref, []);

  delete schema.fields._rperm;
  delete schema.fields._wperm;

  schema.fields.ACL = { type: 'ACL' };

  if (schema.className === '_User') {
    delete schema.fields.authData; //Auth data is implicit
    delete schema.fields._hashed_password;
    schema.fields.password = { type: 'String' };
  }

  if (schema.indexes && Object.keys(schema.indexes).length === 0) {
    delete schema.indexes;
  }

  return schema;
};

const injectDefaultSchema = ({ className, fields, classLevelPermissions, indexes }) => {
  const defaultSchema = {
    className,
    fields: _extends({}, defaultColumns._Default, defaultColumns[className] || {}, fields),
    classLevelPermissions
  };
  if (indexes && Object.keys(indexes).length !== 0) {
    defaultSchema.indexes = indexes;
  }
  return defaultSchema;
};

const _HooksSchema = { className: "_Hooks", fields: defaultColumns._Hooks };
const _GlobalConfigSchema = { className: "_GlobalConfig", fields: defaultColumns._GlobalConfig };
const _PushStatusSchema = convertSchemaToAdapterSchema(injectDefaultSchema({
  className: "_PushStatus",
  fields: {},
  classLevelPermissions: {}
}));
const _JobStatusSchema = convertSchemaToAdapterSchema(injectDefaultSchema({
  className: "_JobStatus",
  fields: {},
  classLevelPermissions: {}
}));
const _JobScheduleSchema = convertSchemaToAdapterSchema(injectDefaultSchema({
  className: "_JobSchedule",
  fields: {},
  classLevelPermissions: {}
}));
const _AudienceSchema = convertSchemaToAdapterSchema(injectDefaultSchema({
  className: "_Audience",
  fields: defaultColumns._Audience,
  classLevelPermissions: {}
}));
const VolatileClassesSchemas = [_HooksSchema, _JobStatusSchema, _JobScheduleSchema, _PushStatusSchema, _GlobalConfigSchema, _AudienceSchema];

const dbTypeMatchesObjectType = (dbType, objectType) => {
  if (dbType.type !== objectType.type) return false;
  if (dbType.targetClass !== objectType.targetClass) return false;
  if (dbType === objectType.type) return true;
  if (dbType.type === objectType.type) return true;
  return false;
};

const typeToString = type => {
  if (typeof type === 'string') {
    return type;
  }
  if (type.targetClass) {
    return `${type.type}<${type.targetClass}>`;
  }
  return `${type.type}`;
};

// Stores the entire schema of the app in a weird hybrid format somewhere between
// the mongo format and the Parse format. Soon, this will all be Parse format.
class SchemaController {

  constructor(databaseAdapter, schemaCache) {
    this._dbAdapter = databaseAdapter;
    this._cache = schemaCache;
    // this.data[className][fieldName] tells you the type of that field, in mongo format
    this.data = {};
    // this.perms[className][operation] tells you the acl-style permissions
    this.perms = {};
    // this.indexes[className][operation] tells you the indexes
    this.indexes = {};
  }

  reloadData(options = { clearCache: false }) {
    let promise = Promise.resolve();
    if (options.clearCache) {
      promise = promise.then(() => {
        return this._cache.clear();
      });
    }
    if (this.reloadDataPromise && !options.clearCache) {
      return this.reloadDataPromise;
    }
    this.reloadDataPromise = promise.then(() => {
      return this.getAllClasses(options).then(allSchemas => {
        const data = {};
        const perms = {};
        const indexes = {};
        allSchemas.forEach(schema => {
          data[schema.className] = injectDefaultSchema(schema).fields;
          perms[schema.className] = schema.classLevelPermissions;
          indexes[schema.className] = schema.indexes;
        });

        // Inject the in-memory classes
        volatileClasses.forEach(className => {
          const schema = injectDefaultSchema({ className, fields: {}, classLevelPermissions: {} });
          data[className] = schema.fields;
          perms[className] = schema.classLevelPermissions;
          indexes[className] = schema.indexes;
        });
        this.data = data;
        this.perms = perms;
        this.indexes = indexes;
        delete this.reloadDataPromise;
      }, err => {
        this.data = {};
        this.perms = {};
        this.indexes = {};
        delete this.reloadDataPromise;
        throw err;
      });
    }).then(() => {});
    return this.reloadDataPromise;
  }

  getAllClasses(options = { clearCache: false }) {
    let promise = Promise.resolve();
    if (options.clearCache) {
      promise = this._cache.clear();
    }
    return promise.then(() => {
      return this._cache.getAllClasses();
    }).then(allClasses => {
      if (allClasses && allClasses.length && !options.clearCache) {
        return Promise.resolve(allClasses);
      }
      return this._dbAdapter.getAllClasses().then(allSchemas => allSchemas.map(injectDefaultSchema)).then(allSchemas => {
        return this._cache.setAllClasses(allSchemas).then(() => {
          return allSchemas;
        });
      });
    });
  }

  getOneSchema(className, allowVolatileClasses = false, options = { clearCache: false }) {
    let promise = Promise.resolve();
    if (options.clearCache) {
      promise = this._cache.clear();
    }
    return promise.then(() => {
      if (allowVolatileClasses && volatileClasses.indexOf(className) > -1) {
        return Promise.resolve({
          className,
          fields: this.data[className],
          classLevelPermissions: this.perms[className],
          indexes: this.indexes[className]
        });
      }
      return this._cache.getOneSchema(className).then(cached => {
        if (cached && !options.clearCache) {
          return Promise.resolve(cached);
        }
        return this._dbAdapter.getClass(className).then(injectDefaultSchema).then(result => {
          return this._cache.setOneSchema(className, result).then(() => {
            return result;
          });
        });
      });
    });
  }

  // Create a new class that includes the three default fields.
  // ACL is an implicit column that does not get an entry in the
  // _SCHEMAS database. Returns a promise that resolves with the
  // created schema, in mongo format.
  // on success, and rejects with an error on fail. Ensure you
  // have authorization (master key, or client class creation
  // enabled) before calling this function.
  addClassIfNotExists(className, fields = {}, classLevelPermissions, indexes = {}) {
    var validationError = this.validateNewClass(className, fields, classLevelPermissions);
    if (validationError) {
      return Promise.reject(validationError);
    }

    return this._dbAdapter.createClass(className, convertSchemaToAdapterSchema({ fields, classLevelPermissions, indexes, className })).then(convertAdapterSchemaToParseSchema).then(res => {
      return this._cache.clear().then(() => {
        return Promise.resolve(res);
      });
    }).catch(error => {
      if (error && error.code === Parse.Error.DUPLICATE_VALUE) {
        throw new Parse.Error(Parse.Error.INVALID_CLASS_NAME, `Class ${className} already exists.`);
      } else {
        throw error;
      }
    });
  }

  updateClass(className, submittedFields, classLevelPermissions, indexes, database) {
    return this.getOneSchema(className).then(schema => {
      const existingFields = schema.fields;
      Object.keys(submittedFields).forEach(name => {
        const field = submittedFields[name];
        if (existingFields[name] && field.__op !== 'Delete') {
          throw new Parse.Error(255, `Field ${name} exists, cannot update.`);
        }
        if (!existingFields[name] && field.__op === 'Delete') {
          throw new Parse.Error(255, `Field ${name} does not exist, cannot delete.`);
        }
      });

      delete existingFields._rperm;
      delete existingFields._wperm;
      const newSchema = buildMergedSchemaObject(existingFields, submittedFields);
      const defaultFields = defaultColumns[className] || defaultColumns._Default;
      const fullNewSchema = Object.assign({}, newSchema, defaultFields);
      const validationError = this.validateSchemaData(className, newSchema, classLevelPermissions, Object.keys(existingFields));
      if (validationError) {
        throw new Parse.Error(validationError.code, validationError.error);
      }

      // Finally we have checked to make sure the request is valid and we can start deleting fields.
      // Do all deletions first, then a single save to _SCHEMA collection to handle all additions.
      const deletedFields = [];
      const insertedFields = [];
      Object.keys(submittedFields).forEach(fieldName => {
        if (submittedFields[fieldName].__op === 'Delete') {
          deletedFields.push(fieldName);
        } else {
          insertedFields.push(fieldName);
        }
      });

      let deletePromise = Promise.resolve();
      if (deletedFields.length > 0) {
        deletePromise = this.deleteFields(deletedFields, className, database);
      }
      return deletePromise // Delete Everything
      .then(() => this.reloadData({ clearCache: true })) // Reload our Schema, so we have all the new values
      .then(() => {
        const promises = insertedFields.map(fieldName => {
          const type = submittedFields[fieldName];
          return this.enforceFieldExists(className, fieldName, type);
        });
        return Promise.all(promises);
      }).then(() => this.setPermissions(className, classLevelPermissions, newSchema)).then(() => this._dbAdapter.setIndexesWithSchemaFormat(className, indexes, schema.indexes, fullNewSchema)).then(() => this.reloadData({ clearCache: true }))
      //TODO: Move this logic into the database adapter
      .then(() => {
        const reloadedSchema = {
          className: className,
          fields: this.data[className],
          classLevelPermissions: this.perms[className]
        };
        if (this.indexes[className] && Object.keys(this.indexes[className]).length !== 0) {
          reloadedSchema.indexes = this.indexes[className];
        }
        return reloadedSchema;
      });
    }).catch(error => {
      if (error === undefined) {
        throw new Parse.Error(Parse.Error.INVALID_CLASS_NAME, `Class ${className} does not exist.`);
      } else {
        throw error;
      }
    });
  }

  // Returns a promise that resolves successfully to the new schema
  // object or fails with a reason.
  enforceClassExists(className) {
    if (this.data[className]) {
      return Promise.resolve(this);
    }
    // We don't have this class. Update the schema
    return this.addClassIfNotExists(className)
    // The schema update succeeded. Reload the schema
    .then(() => this.reloadData({ clearCache: true })).catch(() => {
      // The schema update failed. This can be okay - it might
      // have failed because there's a race condition and a different
      // client is making the exact same schema update that we want.
      // So just reload the schema.
      return this.reloadData({ clearCache: true });
    }).then(() => {
      // Ensure that the schema now validates
      if (this.data[className]) {
        return this;
      } else {
        throw new Parse.Error(Parse.Error.INVALID_JSON, `Failed to add ${className}`);
      }
    }).catch(() => {
      // The schema still doesn't validate. Give up
      throw new Parse.Error(Parse.Error.INVALID_JSON, 'schema class name does not revalidate');
    });
  }

  validateNewClass(className, fields = {}, classLevelPermissions) {
    if (this.data[className]) {
      throw new Parse.Error(Parse.Error.INVALID_CLASS_NAME, `Class ${className} already exists.`);
    }
    if (!classNameIsValid(className)) {
      return {
        code: Parse.Error.INVALID_CLASS_NAME,
        error: invalidClassNameMessage(className)
      };
    }
    return this.validateSchemaData(className, fields, classLevelPermissions, []);
  }

  validateSchemaData(className, fields, classLevelPermissions, existingFieldNames) {
    for (const fieldName in fields) {
      if (existingFieldNames.indexOf(fieldName) < 0) {
        if (!fieldNameIsValid(fieldName)) {
          return {
            code: Parse.Error.INVALID_KEY_NAME,
            error: 'invalid field name: ' + fieldName
          };
        }
        if (!fieldNameIsValidForClass(fieldName, className)) {
          return {
            code: 136,
            error: 'field ' + fieldName + ' cannot be added'
          };
        }
        const error = fieldTypeIsInvalid(fields[fieldName]);
        if (error) return { code: error.code, error: error.message };
      }
    }

    for (const fieldName in defaultColumns[className]) {
      fields[fieldName] = defaultColumns[className][fieldName];
    }

    const geoPoints = Object.keys(fields).filter(key => fields[key] && fields[key].type === 'GeoPoint');
    if (geoPoints.length > 1) {
      return {
        code: Parse.Error.INCORRECT_TYPE,
        error: 'currently, only one GeoPoint field may exist in an object. Adding ' + geoPoints[1] + ' when ' + geoPoints[0] + ' already exists.'
      };
    }
    validateCLP(classLevelPermissions, fields);
  }

  // Sets the Class-level permissions for a given className, which must exist.
  setPermissions(className, perms, newSchema) {
    if (typeof perms === 'undefined') {
      return Promise.resolve();
    }
    validateCLP(perms, newSchema);
    return this._dbAdapter.setClassLevelPermissions(className, perms);
  }

  // Returns a promise that resolves successfully to the new schema
  // object if the provided className-fieldName-type tuple is valid.
  // The className must already be validated.
  // If 'freeze' is true, refuse to update the schema for this field.
  enforceFieldExists(className, fieldName, type) {
    if (fieldName.indexOf(".") > 0) {
      // subdocument key (x.y) => ok if x is of type 'object'
      fieldName = fieldName.split(".")[0];
      type = 'Object';
    }
    if (!fieldNameIsValid(fieldName)) {
      throw new Parse.Error(Parse.Error.INVALID_KEY_NAME, `Invalid field name: ${fieldName}.`);
    }

    // If someone tries to create a new field with null/undefined as the value, return;
    if (!type) {
      return Promise.resolve(this);
    }

    return this.reloadData().then(() => {
      const expectedType = this.getExpectedType(className, fieldName);
      if (typeof type === 'string') {
        type = { type };
      }

      if (expectedType) {
        if (!dbTypeMatchesObjectType(expectedType, type)) {
          throw new Parse.Error(Parse.Error.INCORRECT_TYPE, `schema mismatch for ${className}.${fieldName}; expected ${typeToString(expectedType)} but got ${typeToString(type)}`);
        }
        return this;
      }

      return this._dbAdapter.addFieldIfNotExists(className, fieldName, type).then(() => {
        // The update succeeded. Reload the schema
        return this.reloadData({ clearCache: true });
      }, error => {
        if (error.code == Parse.Error.INCORRECT_TYPE) {
          // Make sure that we throw errors when it is appropriate to do so.
          throw error;
        }
        // The update failed. This can be okay - it might have been a race
        // condition where another client updated the schema in the same
        // way that we wanted to. So, just reload the schema
        return this.reloadData({ clearCache: true });
      }).then(() => {
        // Ensure that the schema now validates
        const expectedType = this.getExpectedType(className, fieldName);
        if (typeof type === 'string') {
          type = { type };
        }
        if (!expectedType || !dbTypeMatchesObjectType(expectedType, type)) {
          throw new Parse.Error(Parse.Error.INVALID_JSON, `Could not add field ${fieldName}`);
        }
        // Remove the cached schema
        this._cache.clear();
        return this;
      });
    });
  }

  // maintain compatibility
  deleteField(fieldName, className, database) {
    return this.deleteFields([fieldName], className, database);
  }

  // Delete fields, and remove that data from all objects. This is intended
  // to remove unused fields, if other writers are writing objects that include
  // this field, the field may reappear. Returns a Promise that resolves with
  // no object on success, or rejects with { code, error } on failure.
  // Passing the database and prefix is necessary in order to drop relation collections
  // and remove fields from objects. Ideally the database would belong to
  // a database adapter and this function would close over it or access it via member.
  deleteFields(fieldNames, className, database) {
    if (!classNameIsValid(className)) {
      throw new Parse.Error(Parse.Error.INVALID_CLASS_NAME, invalidClassNameMessage(className));
    }

    fieldNames.forEach(fieldName => {
      if (!fieldNameIsValid(fieldName)) {
        throw new Parse.Error(Parse.Error.INVALID_KEY_NAME, `invalid field name: ${fieldName}`);
      }
      //Don't allow deleting the default fields.
      if (!fieldNameIsValidForClass(fieldName, className)) {
        throw new Parse.Error(136, `field ${fieldName} cannot be changed`);
      }
    });

    return this.getOneSchema(className, false, { clearCache: true }).catch(error => {
      if (error === undefined) {
        throw new Parse.Error(Parse.Error.INVALID_CLASS_NAME, `Class ${className} does not exist.`);
      } else {
        throw error;
      }
    }).then(schema => {
      fieldNames.forEach(fieldName => {
        if (!schema.fields[fieldName]) {
          throw new Parse.Error(255, `Field ${fieldName} does not exist, cannot delete.`);
        }
      });

      const schemaFields = _extends({}, schema.fields);
      return database.adapter.deleteFields(className, schema, fieldNames).then(() => {
        return Promise.all(fieldNames.map(fieldName => {
          const field = schemaFields[fieldName];
          if (field && field.type === 'Relation') {
            //For relations, drop the _Join table
            return database.adapter.deleteClass(`_Join:${fieldName}:${className}`);
          }
          return Promise.resolve();
        }));
      });
    }).then(() => {
      this._cache.clear();
    });
  }

  // Validates an object provided in REST format.
  // Returns a promise that resolves to the new schema if this object is
  // valid.
  validateObject(className, object, query) {
    let geocount = 0;
    let promise = this.enforceClassExists(className);
    for (const fieldName in object) {
      if (object[fieldName] === undefined) {
        continue;
      }
      const expected = getType(object[fieldName]);
      if (expected === 'GeoPoint') {
        geocount++;
      }
      if (geocount > 1) {
        // Make sure all field validation operations run before we return.
        // If not - we are continuing to run logic, but already provided response from the server.
        return promise.then(() => {
          return Promise.reject(new Parse.Error(Parse.Error.INCORRECT_TYPE, 'there can only be one geopoint field in a class'));
        });
      }
      if (!expected) {
        continue;
      }
      if (fieldName === 'ACL') {
        // Every object has ACL implicitly.
        continue;
      }

      promise = promise.then(schema => schema.enforceFieldExists(className, fieldName, expected));
    }
    promise = thenValidateRequiredColumns(promise, className, object, query);
    return promise;
  }

  // Validates that all the properties are set for the object
  validateRequiredColumns(className, object, query) {
    const columns = requiredColumns[className];
    if (!columns || columns.length == 0) {
      return Promise.resolve(this);
    }

    const missingColumns = columns.filter(function (column) {
      if (query && query.objectId) {
        if (object[column] && typeof object[column] === "object") {
          // Trying to delete a required column
          return object[column].__op == 'Delete';
        }
        // Not trying to do anything there
        return false;
      }
      return !object[column];
    });

    if (missingColumns.length > 0) {
      throw new Parse.Error(Parse.Error.INCORRECT_TYPE, missingColumns[0] + ' is required.');
    }
    return Promise.resolve(this);
  }

  // Validates the base CLP for an operation
  testBaseCLP(className, aclGroup, operation) {
    if (!this.perms[className] || !this.perms[className][operation]) {
      return true;
    }
    const classPerms = this.perms[className];
    const perms = classPerms[operation];
    // Handle the public scenario quickly
    if (perms['*']) {
      return true;
    }
    // Check permissions against the aclGroup provided (array of userId/roles)
    if (aclGroup.some(acl => {
      return perms[acl] === true;
    })) {
      return true;
    }
    return false;
  }

  // Validates an operation passes class-level-permissions set in the schema
  validatePermission(className, aclGroup, operation) {

    if (this.testBaseCLP(className, aclGroup, operation)) {
      return Promise.resolve();
    }

    if (!this.perms[className] || !this.perms[className][operation]) {
      return true;
    }
    const classPerms = this.perms[className];
    const perms = classPerms[operation];

    // If only for authenticated users
    // make sure we have an aclGroup
    if (perms['requiresAuthentication']) {
      // If aclGroup has * (public)
      if (!aclGroup || aclGroup.length == 0) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Permission denied, user needs to be authenticated.');
      } else if (aclGroup.indexOf('*') > -1 && aclGroup.length == 1) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Permission denied, user needs to be authenticated.');
      }
      // requiresAuthentication passed, just move forward
      // probably would be wise at some point to rename to 'authenticatedUser'
      return Promise.resolve();
    }

    // No matching CLP, let's check the Pointer permissions
    // And handle those later
    const permissionField = ['get', 'find', 'count'].indexOf(operation) > -1 ? 'readUserFields' : 'writeUserFields';

    // Reject create when write lockdown
    if (permissionField == 'writeUserFields' && operation == 'create') {
      throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, `Permission denied for action ${operation} on class ${className}.`);
    }

    // Process the readUserFields later
    if (Array.isArray(classPerms[permissionField]) && classPerms[permissionField].length > 0) {
      return Promise.resolve();
    }
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, `Permission denied for action ${operation} on class ${className}.`);
  }

  // Returns the expected type for a className+key combination
  // or undefined if the schema is not set
  getExpectedType(className, fieldName) {
    if (this.data && this.data[className]) {
      const expectedType = this.data[className][fieldName];
      return expectedType === 'map' ? 'Object' : expectedType;
    }
    return undefined;
  }

  // Checks if a given class is in the schema.
  hasClass(className) {
    return this.reloadData().then(() => !!this.data[className]);
  }
}

exports.default = SchemaController; // Returns a promise for a new Schema.

const load = (dbAdapter, schemaCache, options) => {
  const schema = new SchemaController(dbAdapter, schemaCache);
  return schema.reloadData(options).then(() => schema);
};

// Builds a new schema (in schema API response format) out of an
// existing mongo schema + a schemas API put request. This response
// does not include the default fields, as it is intended to be passed
// to mongoSchemaFromFieldsAndClassName. No validation is done here, it
// is done in mongoSchemaFromFieldsAndClassName.
function buildMergedSchemaObject(existingFields, putRequest) {
  const newSchema = {};
  // -disable-next
  const sysSchemaField = Object.keys(defaultColumns).indexOf(existingFields._id) === -1 ? [] : Object.keys(defaultColumns[existingFields._id]);
  for (const oldField in existingFields) {
    if (oldField !== '_id' && oldField !== 'ACL' && oldField !== 'updatedAt' && oldField !== 'createdAt' && oldField !== 'objectId') {
      if (sysSchemaField.length > 0 && sysSchemaField.indexOf(oldField) !== -1) {
        continue;
      }
      const fieldIsDeleted = putRequest[oldField] && putRequest[oldField].__op === 'Delete';
      if (!fieldIsDeleted) {
        newSchema[oldField] = existingFields[oldField];
      }
    }
  }
  for (const newField in putRequest) {
    if (newField !== 'objectId' && putRequest[newField].__op !== 'Delete') {
      if (sysSchemaField.length > 0 && sysSchemaField.indexOf(newField) !== -1) {
        continue;
      }
      newSchema[newField] = putRequest[newField];
    }
  }
  return newSchema;
}

// Given a schema promise, construct another schema promise that
// validates this field once the schema loads.
function thenValidateRequiredColumns(schemaPromise, className, object, query) {
  return schemaPromise.then(schema => {
    return schema.validateRequiredColumns(className, object, query);
  });
}

// Gets the type from a REST API formatted object, where 'type' is
// extended past javascript types to include the rest of the Parse
// type system.
// The output should be a valid schema value.
// TODO: ensure that this is compatible with the format used in Open DB
function getType(obj) {
  const type = typeof obj;
  switch (type) {
    case 'boolean':
      return 'Boolean';
    case 'string':
      return 'String';
    case 'number':
      return 'Number';
    case 'map':
    case 'object':
      if (!obj) {
        return undefined;
      }
      return getObjectType(obj);
    case 'function':
    case 'symbol':
    case 'undefined':
    default:
      throw 'bad obj: ' + obj;
  }
}

// This gets the type for non-JSON types like pointers and files, but
// also gets the appropriate type for $ operators.
// Returns null if the type is unknown.
function getObjectType(obj) {
  if (obj instanceof Array) {
    return 'Array';
  }
  if (obj.__type) {
    switch (obj.__type) {
      case 'Pointer':
        if (obj.className) {
          return {
            type: 'Pointer',
            targetClass: obj.className
          };
        }
        break;
      case 'Relation':
        if (obj.className) {
          return {
            type: 'Relation',
            targetClass: obj.className
          };
        }
        break;
      case 'File':
        if (obj.name) {
          return 'File';
        }
        break;
      case 'Date':
        if (obj.iso) {
          return 'Date';
        }
        break;
      case 'GeoPoint':
        if (obj.latitude != null && obj.longitude != null) {
          return 'GeoPoint';
        }
        break;
      case 'Bytes':
        if (obj.base64) {
          return 'Bytes';
        }
        break;
      case 'Polygon':
        if (obj.coordinates) {
          return 'Polygon';
        }
        break;
    }
    throw new Parse.Error(Parse.Error.INCORRECT_TYPE, "This is not a valid " + obj.__type);
  }
  if (obj['$ne']) {
    return getObjectType(obj['$ne']);
  }
  if (obj.__op) {
    switch (obj.__op) {
      case 'Increment':
        return 'Number';
      case 'Delete':
        return null;
      case 'Add':
      case 'AddUnique':
      case 'Remove':
        return 'Array';
      case 'AddRelation':
      case 'RemoveRelation':
        return {
          type: 'Relation',
          targetClass: obj.objects[0].className
        };
      case 'Batch':
        return getObjectType(obj.ops[0]);
      default:
        throw 'unexpected op: ' + obj.__op;
    }
  }
  return 'Object';
}

exports.load = load;
exports.classNameIsValid = classNameIsValid;
exports.fieldNameIsValid = fieldNameIsValid;
exports.invalidClassNameMessage = invalidClassNameMessage;
exports.buildMergedSchemaObject = buildMergedSchemaObject;
exports.systemClasses = systemClasses;
exports.defaultColumns = defaultColumns;
exports.convertSchemaToAdapterSchema = convertSchemaToAdapterSchema;
exports.VolatileClassesSchemas = VolatileClassesSchemas;
exports.SchemaController = SchemaController;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Db250cm9sbGVycy9TY2hlbWFDb250cm9sbGVyLmpzIl0sIm5hbWVzIjpbIlBhcnNlIiwicmVxdWlyZSIsImRlZmF1bHRDb2x1bW5zIiwiT2JqZWN0IiwiZnJlZXplIiwiX0RlZmF1bHQiLCJ0eXBlIiwiX1VzZXIiLCJfUHJpdmF0ZVJlY29yZCIsIl9QdWJsaWNVc2VyIiwiX1JlY29yZHMiLCJfSW5zdGFsbGF0aW9uIiwiX1JvbGUiLCJ0YXJnZXRDbGFzcyIsIl9TZXNzaW9uIiwiX1Byb2R1Y3QiLCJfUHVzaFN0YXR1cyIsIl9Kb2JTdGF0dXMiLCJfSm9iU2NoZWR1bGUiLCJfSG9va3MiLCJfR2xvYmFsQ29uZmlnIiwiX0F1ZGllbmNlIiwicmVxdWlyZWRDb2x1bW5zIiwic3lzdGVtQ2xhc3NlcyIsInZvbGF0aWxlQ2xhc3NlcyIsInVzZXJJZFJlZ2V4Iiwicm9sZVJlZ2V4IiwicHVibGljUmVnZXgiLCJyZXF1aXJlQXV0aGVudGljYXRpb25SZWdleCIsInBlcm1pc3Npb25LZXlSZWdleCIsInZlcmlmeVBlcm1pc3Npb25LZXkiLCJrZXkiLCJyZXN1bHQiLCJyZWR1Y2UiLCJpc0dvb2QiLCJyZWdFeCIsIm1hdGNoIiwiRXJyb3IiLCJJTlZBTElEX0pTT04iLCJDTFBWYWxpZEtleXMiLCJ2YWxpZGF0ZUNMUCIsInBlcm1zIiwiZmllbGRzIiwia2V5cyIsImZvckVhY2giLCJvcGVyYXRpb24iLCJpbmRleE9mIiwiQXJyYXkiLCJpc0FycmF5IiwicGVybSIsImpvaW5DbGFzc1JlZ2V4IiwiY2xhc3NBbmRGaWVsZFJlZ2V4IiwiY2xhc3NOYW1lSXNWYWxpZCIsImNsYXNzTmFtZSIsInRlc3QiLCJmaWVsZE5hbWVJc1ZhbGlkIiwiZmllbGROYW1lIiwiZmllbGROYW1lSXNWYWxpZEZvckNsYXNzIiwiaW52YWxpZENsYXNzTmFtZU1lc3NhZ2UiLCJpbnZhbGlkSnNvbkVycm9yIiwidmFsaWROb25SZWxhdGlvbk9yUG9pbnRlclR5cGVzIiwiZmllbGRUeXBlSXNJbnZhbGlkIiwiSU5WQUxJRF9DTEFTU19OQU1FIiwidW5kZWZpbmVkIiwiSU5DT1JSRUNUX1RZUEUiLCJjb252ZXJ0U2NoZW1hVG9BZGFwdGVyU2NoZW1hIiwic2NoZW1hIiwiaW5qZWN0RGVmYXVsdFNjaGVtYSIsIkFDTCIsIl9ycGVybSIsIl93cGVybSIsInBhc3N3b3JkIiwiX2hhc2hlZF9wYXNzd29yZCIsImNvbnZlcnRBZGFwdGVyU2NoZW1hVG9QYXJzZVNjaGVtYSIsImF1dGhEYXRhIiwiaW5kZXhlcyIsImxlbmd0aCIsImNsYXNzTGV2ZWxQZXJtaXNzaW9ucyIsImRlZmF1bHRTY2hlbWEiLCJfSG9va3NTY2hlbWEiLCJfR2xvYmFsQ29uZmlnU2NoZW1hIiwiX1B1c2hTdGF0dXNTY2hlbWEiLCJfSm9iU3RhdHVzU2NoZW1hIiwiX0pvYlNjaGVkdWxlU2NoZW1hIiwiX0F1ZGllbmNlU2NoZW1hIiwiVm9sYXRpbGVDbGFzc2VzU2NoZW1hcyIsImRiVHlwZU1hdGNoZXNPYmplY3RUeXBlIiwiZGJUeXBlIiwib2JqZWN0VHlwZSIsInR5cGVUb1N0cmluZyIsIlNjaGVtYUNvbnRyb2xsZXIiLCJjb25zdHJ1Y3RvciIsImRhdGFiYXNlQWRhcHRlciIsInNjaGVtYUNhY2hlIiwiX2RiQWRhcHRlciIsIl9jYWNoZSIsImRhdGEiLCJyZWxvYWREYXRhIiwib3B0aW9ucyIsImNsZWFyQ2FjaGUiLCJwcm9taXNlIiwiUHJvbWlzZSIsInJlc29sdmUiLCJ0aGVuIiwiY2xlYXIiLCJyZWxvYWREYXRhUHJvbWlzZSIsImdldEFsbENsYXNzZXMiLCJhbGxTY2hlbWFzIiwiZXJyIiwiYWxsQ2xhc3NlcyIsIm1hcCIsInNldEFsbENsYXNzZXMiLCJnZXRPbmVTY2hlbWEiLCJhbGxvd1ZvbGF0aWxlQ2xhc3NlcyIsImNhY2hlZCIsImdldENsYXNzIiwic2V0T25lU2NoZW1hIiwiYWRkQ2xhc3NJZk5vdEV4aXN0cyIsInZhbGlkYXRpb25FcnJvciIsInZhbGlkYXRlTmV3Q2xhc3MiLCJyZWplY3QiLCJjcmVhdGVDbGFzcyIsInJlcyIsImNhdGNoIiwiZXJyb3IiLCJjb2RlIiwiRFVQTElDQVRFX1ZBTFVFIiwidXBkYXRlQ2xhc3MiLCJzdWJtaXR0ZWRGaWVsZHMiLCJkYXRhYmFzZSIsImV4aXN0aW5nRmllbGRzIiwibmFtZSIsImZpZWxkIiwiX19vcCIsIm5ld1NjaGVtYSIsImJ1aWxkTWVyZ2VkU2NoZW1hT2JqZWN0IiwiZGVmYXVsdEZpZWxkcyIsImZ1bGxOZXdTY2hlbWEiLCJhc3NpZ24iLCJ2YWxpZGF0ZVNjaGVtYURhdGEiLCJkZWxldGVkRmllbGRzIiwiaW5zZXJ0ZWRGaWVsZHMiLCJwdXNoIiwiZGVsZXRlUHJvbWlzZSIsImRlbGV0ZUZpZWxkcyIsInByb21pc2VzIiwiZW5mb3JjZUZpZWxkRXhpc3RzIiwiYWxsIiwic2V0UGVybWlzc2lvbnMiLCJzZXRJbmRleGVzV2l0aFNjaGVtYUZvcm1hdCIsInJlbG9hZGVkU2NoZW1hIiwiZW5mb3JjZUNsYXNzRXhpc3RzIiwiZXhpc3RpbmdGaWVsZE5hbWVzIiwiSU5WQUxJRF9LRVlfTkFNRSIsIm1lc3NhZ2UiLCJnZW9Qb2ludHMiLCJmaWx0ZXIiLCJzZXRDbGFzc0xldmVsUGVybWlzc2lvbnMiLCJzcGxpdCIsImV4cGVjdGVkVHlwZSIsImdldEV4cGVjdGVkVHlwZSIsImFkZEZpZWxkSWZOb3RFeGlzdHMiLCJkZWxldGVGaWVsZCIsImZpZWxkTmFtZXMiLCJzY2hlbWFGaWVsZHMiLCJhZGFwdGVyIiwiZGVsZXRlQ2xhc3MiLCJ2YWxpZGF0ZU9iamVjdCIsIm9iamVjdCIsInF1ZXJ5IiwiZ2VvY291bnQiLCJleHBlY3RlZCIsImdldFR5cGUiLCJ0aGVuVmFsaWRhdGVSZXF1aXJlZENvbHVtbnMiLCJ2YWxpZGF0ZVJlcXVpcmVkQ29sdW1ucyIsImNvbHVtbnMiLCJtaXNzaW5nQ29sdW1ucyIsImNvbHVtbiIsIm9iamVjdElkIiwidGVzdEJhc2VDTFAiLCJhY2xHcm91cCIsImNsYXNzUGVybXMiLCJzb21lIiwiYWNsIiwidmFsaWRhdGVQZXJtaXNzaW9uIiwiT0JKRUNUX05PVF9GT1VORCIsInBlcm1pc3Npb25GaWVsZCIsIk9QRVJBVElPTl9GT1JCSURERU4iLCJoYXNDbGFzcyIsImxvYWQiLCJkYkFkYXB0ZXIiLCJwdXRSZXF1ZXN0Iiwic3lzU2NoZW1hRmllbGQiLCJfaWQiLCJvbGRGaWVsZCIsImZpZWxkSXNEZWxldGVkIiwibmV3RmllbGQiLCJzY2hlbWFQcm9taXNlIiwib2JqIiwiZ2V0T2JqZWN0VHlwZSIsIl9fdHlwZSIsImlzbyIsImxhdGl0dWRlIiwibG9uZ2l0dWRlIiwiYmFzZTY0IiwiY29vcmRpbmF0ZXMiLCJvYmplY3RzIiwib3BzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFrQkE7O0FBQ0E7Ozs7Ozs7O0FBbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsUUFBUUMsUUFBUSxZQUFSLEVBQXNCRCxLQUFwQzs7O0FBV0EsTUFBTUUsaUJBQTJDQyxPQUFPQyxNQUFQLENBQWM7QUFDN0Q7QUFDQUMsWUFBVTtBQUNSLGdCQUFhLEVBQUNDLE1BQUssUUFBTixFQURMO0FBRVIsaUJBQWEsRUFBQ0EsTUFBSyxNQUFOLEVBRkw7QUFHUixpQkFBYSxFQUFDQSxNQUFLLE1BQU4sRUFITDtBQUlSLFdBQWEsRUFBQ0EsTUFBSyxLQUFOO0FBSkwsR0FGbUQ7QUFRN0Q7QUFDQUMsU0FBTztBQUNMLGdCQUFpQixFQUFDRCxNQUFLLFFBQU4sRUFEWjtBQUVMLGdCQUFpQixFQUFDQSxNQUFLLFFBQU4sRUFGWjtBQUdMLFdBQWlCLEVBQUNBLE1BQUssUUFBTixFQUhaO0FBSUwsVUFBaUIsRUFBQ0EsTUFBSyxRQUFOLEVBSlo7QUFLTCxlQUFpQixFQUFDQSxNQUFLLFFBQU4sRUFMWjtBQU1MLFdBQWlCLEVBQUNBLE1BQUssTUFBTixFQU5aO0FBT0wsV0FBaUIsRUFBQ0EsTUFBSyxRQUFOLEVBUFo7QUFRTCxhQUFpQixFQUFDQSxNQUFLLFFBQU4s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O1FBQ0FHLGdCLEdBQUFBLGdCO1FBQ0FHLHVCLEdBQUFBLHVCO1FBQ0E2RSx1QixHQUFBQSx1QjtRQUNBaEgsYSxHQUFBQSxhO1FBQ0FyQixjLEdBQUFBLGM7UUFDQStELDRCLEdBQUFBLDRCO1FBQ0FvQixzQixHQUFBQSxzQjtRQUNBSyxnQixHQUFBQSxnQiIsImZpbGUiOiJTY2hlbWFDb250cm9sbGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQGZsb3dcbi8vIFRoaXMgY2xhc3MgaGFuZGxlcyBzY2hlbWEgdmFsaWRhdGlvbiwgcGVyc2lzdGVuY2UsIGFuZCBtb2RpZmljYXRpb24uXG4vL1xuLy8gRWFjaCBpbmRpdmlkdWFsIFNjaGVtYSBvYmplY3Qgc2hvdWxkIGJlIGltbXV0YWJsZS4gVGhlIGhlbHBlcnMgdG9cbi8vIGRvIHRoaW5ncyB3aXRoIHRoZSBTY2hlbWEganVzdCByZXR1cm4gYSBuZXcgc2NoZW1hIHdoZW4gdGhlIHNjaGVtYVxuLy8gaXMgY2hhbmdlZC5cbi8vXG4vLyBUaGUgY2Fub25pY2FsIHBsYWNlIHRvIHN0b3JlIHRoaXMgU2NoZW1hIGlzIGluIHRoZSBkYXRhYmFzZSBpdHNlbGYsXG4vLyBpbiBhIF9TQ0hFTUEgY29sbGVjdGlvbi4gVGhpcyBpcyBub3QgdGhlIHJpZ2h0IHdheSB0byBkbyBpdCBmb3IgYW5cbi8vIG9wZW4gc291cmNlIGZyYW1ld29yaywgYnV0IGl0J3MgYmFja3dhcmQgY29tcGF0aWJsZSwgc28gd2UncmVcbi8vIGtlZXBpbmcgaXQgdGhpcyB3YXkgZm9yIG5vdy5cbi8vXG4vLyBJbiBBUEktaGFuZGxpbmcgY29kZSwgeW91IHNob3VsZCBvbmx5IHVzZSB0aGUgU2NoZW1hIGNsYXNzIHZpYSB0aGVcbi8vIERhdGFiYXNlQ29udHJvbGxlci4gVGhpcyB3aWxsIGxldCB1cyByZXBsYWNlIHRoZSBzY2hlbWEgbG9naWMgZm9yXG4vLyBkaWZmZXJlbnQgZGF0YWJhc2VzLlxuLy8gVE9ETzogaGlkZSBhbGwgc2NoZW1hIGxvZ2ljIGluc2lkZSB0aGUgZGF0YWJhc2UgYWRhcHRlci5cbi8vIEBmbG93LWRpc2FibGUtbmV4dFxuY29uc3QgUGFyc2UgPSByZXF1aXJlKCdwYXJzZS9ub2RlJykuUGFyc2U7XG5pbXBvcnQgeyBTdG9yYWdlQWRhcHRlciB9ICAgICBmcm9tICcuLi9BZGFwdGVycy9TdG9yYWdlL1N0b3JhZ2VBZGFwdGVyJztcbmltcG9ydCBEYXRhYmFzZUNvbnRyb2xsZXIgICAgIGZyb20gJy4vRGF0YWJhc2VDb250cm9sbGVyJztcbmltcG9ydCB0eXBlIHtcbiAgU2NoZW1hLFxuICBTY2hlbWFGaWVsZHMsXG4gIENsYXNzTGV2ZWxQZXJtaXNzaW9ucyxcbiAgU2NoZW1hRmllbGQsXG4gIExvYWRTY2hlbWFPcHRpb25zLFxufSBmcm9tICcuL3R5cGVzJztcblxuY29uc3QgZGVmYXVsdENvbHVtbnM6IHtbc3RyaW5nXTogU2NoZW1hRmllbGRzfSA9IE9iamVjdC5mcmVlemUoe1xuICAvLyBDb250YWluIHRoZSBkZWZhdWx0IGNvbHVtbnMgZm9yIGV2ZXJ5IHBhcnNlIG9iamVjdCB0eXBlIChleGNlcHQgX0pvaW4gY29sbGVjdGlvbilcbiAgX0RlZmF1bHQ6IHtcbiAgICBcIm9iamVjdElkXCI6ICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJjcmVhdGVkQXRcIjoge3R5cGU6J0RhdGUnfSxcbiAgICBcInVwZGF0ZWRBdFwiOiB7dHlwZTonRGF0ZSd9LFxuICAgIFwiQUNMXCI6ICAgICAgIHt0eXBlOidBQ0wnfSxcbiAgfSxcbiAgLy8gVGhlIGFkZGl0aW9uYWwgZGVmYXVsdCBjb2x1bW5zIGZvciB0aGUgX1VzZXIgY29sbGVjdGlvbiAoaW4gYWRkaXRpb24gdG8gRGVmYXVsdENvbHMpXG4gIF9Vc2VyOiB7XG4gICAgXCJ1c2VybmFtZVwiOiAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInBhc3N3b3JkXCI6ICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiaW1nXCI6ICAgICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJpcFwiOiAgICAgICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImNvdW50cnlcIjogICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiaW1nXCI6ICAgICAgICAgICB7dHlwZTonRmlsZSd9LFxuICAgIFwiRkNNXCI6ICAgICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJlbWFpbFwiOiAgICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImVtYWlsVmVyaWZpZWRcIjoge3R5cGU6J0Jvb2xlYW4nfSxcbiAgICBcImF1dGhEYXRhXCI6ICAgICAge3R5cGU6J09iamVjdCd9LFxuICAgIFwibmV3XCI6ICAgICAgICAgICB7dHlwZTonTnVtYmVyJ30sXG4gIH0sXG4gIFxuICBfUHJpdmF0ZVJlY29yZDoge1xuICAgIFwicmVjb3JkSWRcIjogICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJzZW5kZXJcIjogICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImZpbGVcIjogICAgICAgICAgIHt0eXBlOidGaWxlJ30sXG4gICAgXCJyZWNlaXZlcklkXCI6ICAge3R5cGU6J1N0cmluZyd9XG4gIH0sXG4gIFxuICAgX1B1YmxpY1VzZXI6IHtcbiAgICBcInVzZXJuYW1lXCI6ICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwidXNlcklkXCI6ICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiaW1nXCI6ICAgICAgICAgICB7dHlwZTonRmlsZSd9XG4gIH0sXG4gIFxuICBfUmVjb3Jkczoge1xuICAgIFwicmVjZWl2ZXJJRFwiOiAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInJlY2VpdmVyXCI6ICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiZmlsZVwiOiAgICAgICAgICAge3R5cGU6J0ZpbGUnfVxuICB9LFxuICBcbiAgLy8gVGhlIGFkZGl0aW9uYWwgZGVmYXVsdCBjb2x1bW5zIGZvciB0aGUgX0luc3RhbGxhdGlvbiBjb2xsZWN0aW9uIChpbiBhZGRpdGlvbiB0byBEZWZhdWx0Q29scylcbiAgX0luc3RhbGxhdGlvbjoge1xuICAgIFwiaW5zdGFsbGF0aW9uSWRcIjogICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJkZXZpY2VUb2tlblwiOiAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImNoYW5uZWxzXCI6ICAgICAgICAge3R5cGU6J0FycmF5J30sXG4gICAgXCJkZXZpY2VUeXBlXCI6ICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInB1c2hUeXBlXCI6ICAgICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiR0NNU2VuZGVySWRcIjogICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJ0aW1lWm9uZVwiOiAgICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImxvY2FsZUlkZW50aWZpZXJcIjoge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiYmFkZ2VcIjogICAgICAgICAgICB7dHlwZTonTnVtYmVyJ30sXG4gICAgXCJhcHBWZXJzaW9uXCI6ICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImFwcE5hbWVcIjogICAgICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiYXBwSWRlbnRpZmllclwiOiAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJwYXJzZVZlcnNpb25cIjogICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgfSxcbiAgLy8gVGhlIGFkZGl0aW9uYWwgZGVmYXVsdCBjb2x1bW5zIGZvciB0aGUgX1JvbGUgY29sbGVjdGlvbiAoaW4gYWRkaXRpb24gdG8gRGVmYXVsdENvbHMpXG4gIF9Sb2xlOiB7XG4gICAgXCJuYW1lXCI6ICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJ1c2Vyc1wiOiB7dHlwZTonUmVsYXRpb24nLCB0YXJnZXRDbGFzczonX1VzZXInfSxcbiAgICBcInJvbGVzXCI6IHt0eXBlOidSZWxhdGlvbicsIHRhcmdldENsYXNzOidfUm9sZSd9XG4gIH0sXG4gIC8vIFRoZSBhZGRpdGlvbmFsIGRlZmF1bHQgY29sdW1ucyBmb3IgdGhlIF9TZXNzaW9uIGNvbGxlY3Rpb24gKGluIGFkZGl0aW9uIHRvIERlZmF1bHRDb2xzKVxuICBfU2Vzc2lvbjoge1xuICAgIFwicmVzdHJpY3RlZFwiOiAgICAge3R5cGU6J0Jvb2xlYW4nfSxcbiAgICBcInVzZXJcIjogICAgICAgICAgIHt0eXBlOidQb2ludGVyJywgdGFyZ2V0Q2xhc3M6J19Vc2VyJ30sXG4gICAgXCJpbnN0YWxsYXRpb25JZFwiOiB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJzZXNzaW9uVG9rZW5cIjogICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJleHBpcmVzQXRcIjogICAgICB7dHlwZTonRGF0ZSd9LFxuICAgIFwiY3JlYXRlZFdpdGhcIjogICAge3R5cGU6J09iamVjdCd9XG4gIH0sXG4gIF9Qcm9kdWN0OiB7XG4gICAgXCJwcm9kdWN0SWRlbnRpZmllclwiOiAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiZG93bmxvYWRcIjogICAgICAgICAgIHt0eXBlOidGaWxlJ30sXG4gICAgXCJkb3dubG9hZE5hbWVcIjogICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiaWNvblwiOiAgICAgICAgICAgICAgIHt0eXBlOidGaWxlJ30sXG4gICAgXCJvcmRlclwiOiAgICAgICAgICAgICAge3R5cGU6J051bWJlcid9LFxuICAgIFwidGl0bGVcIjogICAgICAgICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInN1YnRpdGxlXCI6ICAgICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gIH0sXG4gIF9QdXNoU3RhdHVzOiB7XG4gICAgXCJwdXNoVGltZVwiOiAgICAgICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInNvdXJjZVwiOiAgICAgICAgICAgICAge3R5cGU6J1N0cmluZyd9LCAvLyByZXN0IG9yIHdlYnVpXG4gICAgXCJxdWVyeVwiOiAgICAgICAgICAgICAgIHt0eXBlOidTdHJpbmcnfSwgLy8gdGhlIHN0cmluZ2lmaWVkIEpTT04gcXVlcnlcbiAgICBcInBheWxvYWRcIjogICAgICAgICAgICAge3R5cGU6J1N0cmluZyd9LCAvLyB0aGUgc3RyaW5naWZpZWQgSlNPTiBwYXlsb2FkLFxuICAgIFwidGl0bGVcIjogICAgICAgICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJleHBpcnlcIjogICAgICAgICAgICAgIHt0eXBlOidOdW1iZXInfSxcbiAgICBcImV4cGlyYXRpb25faW50ZXJ2YWxcIjoge3R5cGU6J051bWJlcid9LFxuICAgIFwic3RhdHVzXCI6ICAgICAgICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJudW1TZW50XCI6ICAgICAgICAgICAgIHt0eXBlOidOdW1iZXInfSxcbiAgICBcIm51bUZhaWxlZFwiOiAgICAgICAgICAge3R5cGU6J051bWJlcid9LFxuICAgIFwicHVzaEhhc2hcIjogICAgICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJlcnJvck1lc3NhZ2VcIjogICAgICAgIHt0eXBlOidPYmplY3QnfSxcbiAgICBcInNlbnRQZXJUeXBlXCI6ICAgICAgICAge3R5cGU6J09iamVjdCd9LFxuICAgIFwiZmFpbGVkUGVyVHlwZVwiOiAgICAgICB7dHlwZTonT2JqZWN0J30sXG4gICAgXCJzZW50UGVyVVRDT2Zmc2V0XCI6ICAgIHt0eXBlOidPYmplY3QnfSxcbiAgICBcImZhaWxlZFBlclVUQ09mZnNldFwiOiAge3R5cGU6J09iamVjdCd9LFxuICAgIFwiY291bnRcIjogICAgICAgICAgICAgICB7dHlwZTonTnVtYmVyJ30gLy8gdHJhY2tzICMgb2YgYmF0Y2hlcyBxdWV1ZWQgYW5kIHBlbmRpbmdcbiAgfSxcbiAgX0pvYlN0YXR1czoge1xuICAgIFwiam9iTmFtZVwiOiAgICB7dHlwZTogJ1N0cmluZyd9LFxuICAgIFwic291cmNlXCI6ICAgICB7dHlwZTogJ1N0cmluZyd9LFxuICAgIFwic3RhdHVzXCI6ICAgICB7dHlwZTogJ1N0cmluZyd9LFxuICAgIFwibWVzc2FnZVwiOiAgICB7dHlwZTogJ1N0cmluZyd9LFxuICAgIFwicGFyYW1zXCI6ICAgICB7dHlwZTogJ09iamVjdCd9LCAvLyBwYXJhbXMgcmVjZWl2ZWQgd2hlbiBjYWxsaW5nIHRoZSBqb2JcbiAgICBcImZpbmlzaGVkQXRcIjoge3R5cGU6ICdEYXRlJ31cbiAgfSxcbiAgX0pvYlNjaGVkdWxlOiB7XG4gICAgXCJqb2JOYW1lXCI6ICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiZGVzY3JpcHRpb25cIjogIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInBhcmFtc1wiOiAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJzdGFydEFmdGVyXCI6ICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiZGF5c09mV2Vla1wiOiAgIHt0eXBlOidBcnJheSd9LFxuICAgIFwidGltZU9mRGF5XCI6ICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImxhc3RSdW5cIjogICAgICB7dHlwZTonTnVtYmVyJ30sXG4gICAgXCJyZXBlYXRNaW51dGVzXCI6e3R5cGU6J051bWJlcid9XG4gIH0sXG4gIF9Ib29rczoge1xuICAgIFwiZnVuY3Rpb25OYW1lXCI6IHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImNsYXNzTmFtZVwiOiAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJ0cmlnZ2VyTmFtZVwiOiAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwidXJsXCI6ICAgICAgICAgIHt0eXBlOidTdHJpbmcnfVxuICB9LFxuICBfR2xvYmFsQ29uZmlnOiB7XG4gICAgXCJvYmplY3RJZFwiOiB7dHlwZTogJ1N0cmluZyd9LFxuICAgIFwicGFyYW1zXCI6ICAge3R5cGU6ICdPYmplY3QnfVxuICB9LFxuICBfQXVkaWVuY2U6IHtcbiAgICBcIm9iamVjdElkXCI6ICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJuYW1lXCI6ICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwicXVlcnlcIjogICAgIHt0eXBlOidTdHJpbmcnfSwgLy9zdG9yaW5nIHF1ZXJ5IGFzIEpTT04gc3RyaW5nIHRvIHByZXZlbnQgXCJOZXN0ZWQga2V5cyBzaG91bGQgbm90IGNvbnRhaW4gdGhlICckJyBvciAnLicgY2hhcmFjdGVyc1wiIGVycm9yXG4gICAgXCJsYXN0VXNlZFwiOiAge3R5cGU6J0RhdGUnfSxcbiAgICBcInRpbWVzVXNlZFwiOiB7dHlwZTonTnVtYmVyJ31cbiAgfVxufSk7XG5cbmNvbnN0IHJlcXVpcmVkQ29sdW1ucyA9IE9iamVjdC5mcmVlemUoe1xuICBfUHJvZHVjdDogW1wicHJvZHVjdElkZW50aWZpZXJcIiwgXCJpY29uXCIsIFwib3JkZXJcIiwgXCJ0aXRsZVwiLCBcInN1YnRpdGxlXCJdLFxuICBfUm9sZTogW1wibmFtZVwiLCBcIkFDTFwiXVxufSk7XG5cbmNvbnN0IHN5c3RlbUNsYXNzZXMgPSBPYmplY3QuZnJlZXplKFsnX1VzZXInLCAnX1B1YmxpY1VzZXInLCAnX1JlY29yZHMnLCAnX1ByaXZhdGVSZWNvcmQnLCAnX0luc3RhbGxhdGlvbicsICdfUm9sZScsICdfU2Vzc2lvbicsICdfUHJvZHVjdCcsICdfUHVzaFN0YXR1cycsICdfSm9iU3RhdHVzJywgJ19Kb2JTY2hlZHVsZScsICdfQXVkaWVuY2UnXSk7XG5cbmNvbnN0IHZvbGF0aWxlQ2xhc3NlcyA9IE9iamVjdC5mcmVlemUoWydfSm9iU3RhdHVzJywgJ19QdXNoU3RhdHVzJywgJ19Ib29rcycsICdfR2xvYmFsQ29uZmlnJywgJ19Kb2JTY2hlZHVsZScsICdfQXVkaWVuY2UnXSk7XG5cbi8vIDEwIGFscGhhIG51bWJlcmljIGNoYXJzICsgdXBwZXJjYXNlXG5jb25zdCB1c2VySWRSZWdleCA9IC9eW2EtekEtWjAtOV17MTB9JC87XG4vLyBBbnl0aGluZyB0aGF0IHN0YXJ0IHdpdGggcm9sZVxuY29uc3Qgcm9sZVJlZ2V4ID0gL15yb2xlOi4qLztcbi8vICogcGVybWlzc2lvblxuY29uc3QgcHVibGljUmVnZXggPSAvXlxcKiQvXG5cbmNvbnN0IHJlcXVpcmVBdXRoZW50aWNhdGlvblJlZ2V4ID0gL15yZXF1aXJlc0F1dGhlbnRpY2F0aW9uJC9cblxuY29uc3QgcGVybWlzc2lvbktleVJlZ2V4ID0gT2JqZWN0LmZyZWV6ZShbdXNlcklkUmVnZXgsIHJvbGVSZWdleCwgcHVibGljUmVnZXgsIHJlcXVpcmVBdXRoZW50aWNhdGlvblJlZ2V4XSk7XG5cbmZ1bmN0aW9uIHZlcmlmeVBlcm1pc3Npb25LZXkoa2V5KSB7XG4gIGNvbnN0IHJlc3VsdCA9IHBlcm1pc3Npb25LZXlSZWdleC5yZWR1Y2UoKGlzR29vZCwgcmVnRXgpID0+IHtcbiAgICBpc0dvb2QgPSBpc0dvb2QgfHwga2V5Lm1hdGNoKHJlZ0V4KSAhPSBudWxsO1xuICAgIHJldHVybiBpc0dvb2Q7XG4gIH0sIGZhbHNlKTtcbiAgaWYgKCFyZXN1bHQpIHtcbiAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCBgJyR7a2V5fScgaXMgbm90IGEgdmFsaWQga2V5IGZvciBjbGFzcyBsZXZlbCBwZXJtaXNzaW9uc2ApO1xuICB9XG59XG5cbmNvbnN0IENMUFZhbGlkS2V5cyA9IE9iamVjdC5mcmVlemUoWydmaW5kJywgJ2NvdW50JywgJ2dldCcsICdjcmVhdGUnLCAndXBkYXRlJywgJ2RlbGV0ZScsICdhZGRGaWVsZCcsICdyZWFkVXNlckZpZWxkcycsICd3cml0ZVVzZXJGaWVsZHMnXSk7XG5mdW5jdGlvbiB2YWxpZGF0ZUNMUChwZXJtczogQ2xhc3NMZXZlbFBlcm1pc3Npb25zLCBmaWVsZHM6IFNjaGVtYUZpZWxkcykge1xuICBpZiAoIXBlcm1zKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIE9iamVjdC5rZXlzKHBlcm1zKS5mb3JFYWNoKChvcGVyYXRpb24pID0+IHtcbiAgICBpZiAoQ0xQVmFsaWRLZXlzLmluZGV4T2Yob3BlcmF0aW9uKSA9PSAtMSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgYCR7b3BlcmF0aW9ufSBpcyBub3QgYSB2YWxpZCBvcGVyYXRpb24gZm9yIGNsYXNzIGxldmVsIHBlcm1pc3Npb25zYCk7XG4gICAgfVxuICAgIGlmICghcGVybXNbb3BlcmF0aW9uXSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChvcGVyYXRpb24gPT09ICdyZWFkVXNlckZpZWxkcycgfHwgb3BlcmF0aW9uID09PSAnd3JpdGVVc2VyRmllbGRzJykge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHBlcm1zW29wZXJhdGlvbl0pKSB7XG4gICAgICAgIC8vIEBmbG93LWRpc2FibGUtbmV4dFxuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCBgJyR7cGVybXNbb3BlcmF0aW9uXX0nIGlzIG5vdCBhIHZhbGlkIHZhbHVlIGZvciBjbGFzcyBsZXZlbCBwZXJtaXNzaW9ucyAke29wZXJhdGlvbn1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlcm1zW29wZXJhdGlvbl0uZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgICAgaWYgKCFmaWVsZHNba2V5XSB8fCBmaWVsZHNba2V5XS50eXBlICE9ICdQb2ludGVyJyB8fCBmaWVsZHNba2V5XS50YXJnZXRDbGFzcyAhPSAnX1VzZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCBgJyR7a2V5fScgaXMgbm90IGEgdmFsaWQgY29sdW1uIGZvciBjbGFzcyBsZXZlbCBwb2ludGVyIHBlcm1pc3Npb25zICR7b3BlcmF0aW9ufWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQGZsb3ctZGlzYWJsZS1uZXh0XG4gICAgT2JqZWN0LmtleXMocGVybXNbb3BlcmF0aW9uXSkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICB2ZXJpZnlQZXJtaXNzaW9uS2V5KGtleSk7XG4gICAgICAvLyBAZmxvdy1kaXNhYmxlLW5leHRcbiAgICAgIGNvbnN0IHBlcm0gPSBwZXJtc1tvcGVyYXRpb25dW2tleV07XG4gICAgICBpZiAocGVybSAhPT0gdHJ1ZSkge1xuICAgICAgICAvLyBAZmxvdy1kaXNhYmxlLW5leHRcbiAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgYCcke3Blcm19JyBpcyBub3QgYSB2YWxpZCB2YWx1ZSBmb3IgY2xhc3MgbGV2ZWwgcGVybWlzc2lvbnMgJHtvcGVyYXRpb259OiR7a2V5fToke3Blcm19YCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuY29uc3Qgam9pbkNsYXNzUmVnZXggPSAvXl9Kb2luOltBLVphLXowLTlfXSs6W0EtWmEtejAtOV9dKy87XG5jb25zdCBjbGFzc0FuZEZpZWxkUmVnZXggPSAvXltBLVphLXpdW0EtWmEtejAtOV9dKiQvO1xuZnVuY3Rpb24gY2xhc3NOYW1lSXNWYWxpZChjbGFzc05hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAvLyBWYWxpZCBjbGFzc2VzIG11c3Q6XG4gIHJldHVybiAoXG4gICAgLy8gQmUgb25lIG9mIF9Vc2VyLCBfSW5zdGFsbGF0aW9uLCBfUm9sZSwgX1Nlc3Npb24gT1JcbiAgICBzeXN0ZW1DbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKSA+IC0xIHx8XG4gICAgLy8gQmUgYSBqb2luIHRhYmxlIE9SXG4gICAgam9pbkNsYXNzUmVnZXgudGVzdChjbGFzc05hbWUpIHx8XG4gICAgLy8gSW5jbHVkZSBvbmx5IGFscGhhLW51bWVyaWMgYW5kIHVuZGVyc2NvcmVzLCBhbmQgbm90IHN0YXJ0IHdpdGggYW4gdW5kZXJzY29yZSBvciBudW1iZXJcbiAgICBmaWVsZE5hbWVJc1ZhbGlkKGNsYXNzTmFtZSlcbiAgKTtcbn1cblxuLy8gVmFsaWQgZmllbGRzIG11c3QgYmUgYWxwaGEtbnVtZXJpYywgYW5kIG5vdCBzdGFydCB3aXRoIGFuIHVuZGVyc2NvcmUgb3IgbnVtYmVyXG5mdW5jdGlvbiBmaWVsZE5hbWVJc1ZhbGlkKGZpZWxkTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBjbGFzc0FuZEZpZWxkUmVnZXgudGVzdChmaWVsZE5hbWUpO1xufVxuXG4vLyBDaGVja3MgdGhhdCBpdCdzIG5vdCB0cnlpbmcgdG8gY2xvYmJlciBvbmUgb2YgdGhlIGRlZmF1bHQgZmllbGRzIG9mIHRoZSBjbGFzcy5cbmZ1bmN0aW9uIGZpZWxkTmFtZUlzVmFsaWRGb3JDbGFzcyhmaWVsZE5hbWU6IHN0cmluZywgY2xhc3NOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgaWYgKCFmaWVsZE5hbWVJc1ZhbGlkKGZpZWxkTmFtZSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGRlZmF1bHRDb2x1bW5zLl9EZWZhdWx0W2ZpZWxkTmFtZV0pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGRlZmF1bHRDb2x1bW5zW2NsYXNzTmFtZV0gJiYgZGVmYXVsdENvbHVtbnNbY2xhc3NOYW1lXVtmaWVsZE5hbWVdKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBpbnZhbGlkQ2xhc3NOYW1lTWVzc2FnZShjbGFzc05hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiAnSW52YWxpZCBjbGFzc25hbWU6ICcgKyBjbGFzc05hbWUgKyAnLCBjbGFzc25hbWVzIGNhbiBvbmx5IGhhdmUgYWxwaGFudW1lcmljIGNoYXJhY3RlcnMgYW5kIF8sIGFuZCBtdXN0IHN0YXJ0IHdpdGggYW4gYWxwaGEgY2hhcmFjdGVyICc7XG59XG5cbmNvbnN0IGludmFsaWRKc29uRXJyb3IgPSBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCBcImludmFsaWQgSlNPTlwiKTtcbmNvbnN0IHZhbGlkTm9uUmVsYXRpb25PclBvaW50ZXJUeXBlcyA9IFtcbiAgJ051bWJlcicsXG4gICdTdHJpbmcnLFxuICAnQm9vbGVhbicsXG4gICdEYXRlJyxcbiAgJ09iamVjdCcsXG4gICdBcnJheScsXG4gICdHZW9Qb2ludCcsXG4gICdGaWxlJyxcbiAgJ0J5dGVzJyxcbiAgJ1BvbHlnb24nXG5dO1xuLy8gUmV0dXJucyBhbiBlcnJvciBzdWl0YWJsZSBmb3IgdGhyb3dpbmcgaWYgdGhlIHR5cGUgaXMgaW52YWxpZFxuY29uc3QgZmllbGRUeXBlSXNJbnZhbGlkID0gKHsgdHlwZSwgdGFyZ2V0Q2xhc3MgfSkgPT4ge1xuICBpZiAoWydQb2ludGVyJywgJ1JlbGF0aW9uJ10uaW5kZXhPZih0eXBlKSA+PSAwKSB7XG4gICAgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgcmV0dXJuIG5ldyBQYXJzZS5FcnJvcigxMzUsIGB0eXBlICR7dHlwZX0gbmVlZHMgYSBjbGFzcyBuYW1lYCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGFyZ2V0Q2xhc3MgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gaW52YWxpZEpzb25FcnJvcjtcbiAgICB9IGVsc2UgaWYgKCFjbGFzc05hbWVJc1ZhbGlkKHRhcmdldENsYXNzKSkge1xuICAgICAgcmV0dXJuIG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0NMQVNTX05BTUUsIGludmFsaWRDbGFzc05hbWVNZXNzYWdlKHRhcmdldENsYXNzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG4gIGlmICh0eXBlb2YgdHlwZSAhPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gaW52YWxpZEpzb25FcnJvcjtcbiAgfVxuICBpZiAodmFsaWROb25SZWxhdGlvbk9yUG9pbnRlclR5cGVzLmluZGV4T2YodHlwZSkgPCAwKSB7XG4gICAgcmV0dXJuIG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTkNPUlJFQ1RfVFlQRSwgYGludmFsaWQgZmllbGQgdHlwZTogJHt0eXBlfWApO1xuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmNvbnN0IGNvbnZlcnRTY2hlbWFUb0FkYXB0ZXJTY2hlbWEgPSAoc2NoZW1hOiBhbnkpID0+IHtcbiAgc2NoZW1hID0gaW5qZWN0RGVmYXVsdFNjaGVtYShzY2hlbWEpO1xuICBkZWxldGUgc2NoZW1hLmZpZWxkcy5BQ0w7XG4gIHNjaGVtYS5maWVsZHMuX3JwZXJtID0geyB0eXBlOiAnQXJyYXknIH07XG4gIHNjaGVtYS5maWVsZHMuX3dwZXJtID0geyB0eXBlOiAnQXJyYXknIH07XG5cbiAgaWYgKHNjaGVtYS5jbGFzc05hbWUgPT09ICdfVXNlcicpIHtcbiAgICBkZWxldGUgc2NoZW1hLmZpZWxkcy5wYXNzd29yZDtcbiAgICBzY2hlbWEuZmllbGRzLl9oYXNoZWRfcGFzc3dvcmQgPSB7IHR5cGU6ICdTdHJpbmcnIH07XG4gIH1cblxuICByZXR1cm4gc2NoZW1hO1xufVxuXG5jb25zdCBjb252ZXJ0QWRhcHRlclNjaGVtYVRvUGFyc2VTY2hlbWEgPSAoey4uLnNjaGVtYX0pID0+IHtcbiAgZGVsZXRlIHNjaGVtYS5maWVsZHMuX3JwZXJtO1xuICBkZWxldGUgc2NoZW1hLmZpZWxkcy5fd3Blcm07XG5cbiAgc2NoZW1hLmZpZWxkcy5BQ0wgPSB7IHR5cGU6ICdBQ0wnIH07XG5cbiAgaWYgKHNjaGVtYS5jbGFzc05hbWUgPT09ICdfVXNlcicpIHtcbiAgICBkZWxldGUgc2NoZW1hLmZpZWxkcy5hdXRoRGF0YTsgLy9BdXRoIGRhdGEgaXMgaW1wbGljaXRcbiAgICBkZWxldGUgc2NoZW1hLmZpZWxkcy5faGFzaGVkX3Bhc3N3b3JkO1xuICAgIHNjaGVtYS5maWVsZHMucGFzc3dvcmQgPSB7IHR5cGU6ICdTdHJpbmcnIH07XG4gIH1cblxuICBpZiAoc2NoZW1hLmluZGV4ZXMgJiYgT2JqZWN0LmtleXMoc2NoZW1hLmluZGV4ZXMpLmxlbmd0aCA9PT0gMCkge1xuICAgIGRlbGV0ZSBzY2hlbWEuaW5kZXhlcztcbiAgfVxuXG4gIHJldHVybiBzY2hlbWE7XG59XG5cbmNvbnN0IGluamVjdERlZmF1bHRTY2hlbWEgPSAoe2NsYXNzTmFtZSwgZmllbGRzLCBjbGFzc0xldmVsUGVybWlzc2lvbnMsIGluZGV4ZXN9OiBTY2hlbWEpID0+IHtcbiAgY29uc3QgZGVmYXVsdFNjaGVtYTogU2NoZW1hID0ge1xuICAgIGNsYXNzTmFtZSxcbiAgICBmaWVsZHM6IHtcbiAgICAgIC4uLmRlZmF1bHRDb2x1bW5zLl9EZWZhdWx0LFxuICAgICAgLi4uKGRlZmF1bHRDb2x1bW5zW2NsYXNzTmFtZV0gfHwge30pLFxuICAgICAgLi4uZmllbGRzLFxuICAgIH0sXG4gICAgY2xhc3NMZXZlbFBlcm1pc3Npb25zLFxuICB9O1xuICBpZiAoaW5kZXhlcyAmJiBPYmplY3Qua2V5cyhpbmRleGVzKS5sZW5ndGggIT09IDApIHtcbiAgICBkZWZhdWx0U2NoZW1hLmluZGV4ZXMgPSBpbmRleGVzO1xuICB9XG4gIHJldHVybiBkZWZhdWx0U2NoZW1hO1xufTtcblxuY29uc3QgX0hvb2tzU2NoZW1hID0gIHtjbGFzc05hbWU6IFwiX0hvb2tzXCIsIGZpZWxkczogZGVmYXVsdENvbHVtbnMuX0hvb2tzfTtcbmNvbnN0IF9HbG9iYWxDb25maWdTY2hlbWEgPSB7IGNsYXNzTmFtZTogXCJfR2xvYmFsQ29uZmlnXCIsIGZpZWxkczogZGVmYXVsdENvbHVtbnMuX0dsb2JhbENvbmZpZyB9XG5jb25zdCBfUHVzaFN0YXR1c1NjaGVtYSA9IGNvbnZlcnRTY2hlbWFUb0FkYXB0ZXJTY2hlbWEoaW5qZWN0RGVmYXVsdFNjaGVtYSh7XG4gIGNsYXNzTmFtZTogXCJfUHVzaFN0YXR1c1wiLFxuICBmaWVsZHM6IHt9LFxuICBjbGFzc0xldmVsUGVybWlzc2lvbnM6IHt9XG59KSk7XG5jb25zdCBfSm9iU3RhdHVzU2NoZW1hID0gY29udmVydFNjaGVtYVRvQWRhcHRlclNjaGVtYShpbmplY3REZWZhdWx0U2NoZW1hKHtcbiAgY2xhc3NOYW1lOiBcIl9Kb2JTdGF0dXNcIixcbiAgZmllbGRzOiB7fSxcbiAgY2xhc3NMZXZlbFBlcm1pc3Npb25zOiB7fVxufSkpO1xuY29uc3QgX0pvYlNjaGVkdWxlU2NoZW1hID0gY29udmVydFNjaGVtYVRvQWRhcHRlclNjaGVtYShpbmplY3REZWZhdWx0U2NoZW1hKHtcbiAgY2xhc3NOYW1lOiBcIl9Kb2JTY2hlZHVsZVwiLFxuICBmaWVsZHM6IHt9LFxuICBjbGFzc0xldmVsUGVybWlzc2lvbnM6IHt9XG59KSk7XG5jb25zdCBfQXVkaWVuY2VTY2hlbWEgPSBjb252ZXJ0U2NoZW1hVG9BZGFwdGVyU2NoZW1hKGluamVjdERlZmF1bHRTY2hlbWEoe1xuICBjbGFzc05hbWU6IFwiX0F1ZGllbmNlXCIsXG4gIGZpZWxkczogZGVmYXVsdENvbHVtbnMuX0F1ZGllbmNlLFxuICBjbGFzc0xldmVsUGVybWlzc2lvbnM6IHt9XG59KSk7XG5jb25zdCBWb2xhdGlsZUNsYXNzZXNTY2hlbWFzID0gW19Ib29rc1NjaGVtYSwgX0pvYlN0YXR1c1NjaGVtYSwgX0pvYlNjaGVkdWxlU2NoZW1hLCBfUHVzaFN0YXR1c1NjaGVtYSwgX0dsb2JhbENvbmZpZ1NjaGVtYSwgX0F1ZGllbmNlU2NoZW1hXTtcblxuY29uc3QgZGJUeXBlTWF0Y2hlc09iamVjdFR5cGUgPSAoZGJUeXBlOiBTY2hlbWFGaWVsZCB8IHN0cmluZywgb2JqZWN0VHlwZTogU2NoZW1hRmllbGQpID0+IHtcbiAgaWYgKGRiVHlwZS50eXBlICE9PSBvYmplY3RUeXBlLnR5cGUpIHJldHVybiBmYWxzZTtcbiAgaWYgKGRiVHlwZS50YXJnZXRDbGFzcyAhPT0gb2JqZWN0VHlwZS50YXJnZXRDbGFzcykgcmV0dXJuIGZhbHNlO1xuICBpZiAoZGJUeXBlID09PSBvYmplY3RUeXBlLnR5cGUpIHJldHVybiB0cnVlO1xuICBpZiAoZGJUeXBlLnR5cGUgPT09IG9iamVjdFR5cGUudHlwZSkgcmV0dXJuIHRydWU7XG4gIHJldHVybiBmYWxzZTtcbn1cblxuY29uc3QgdHlwZVRvU3RyaW5nID0gKHR5cGU6IFNjaGVtYUZpZWxkIHwgc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgaWYgKHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiB0eXBlO1xuICB9XG4gIGlmICh0eXBlLnRhcmdldENsYXNzKSB7XG4gICAgcmV0dXJuIGAke3R5cGUudHlwZX08JHt0eXBlLnRhcmdldENsYXNzfT5gO1xuICB9XG4gIHJldHVybiBgJHt0eXBlLnR5cGV9YDtcbn1cblxuLy8gU3RvcmVzIHRoZSBlbnRpcmUgc2NoZW1hIG9mIHRoZSBhcHAgaW4gYSB3ZWlyZCBoeWJyaWQgZm9ybWF0IHNvbWV3aGVyZSBiZXR3ZWVuXG4vLyB0aGUgbW9uZ28gZm9ybWF0IGFuZCB0aGUgUGFyc2UgZm9ybWF0LiBTb29uLCB0aGlzIHdpbGwgYWxsIGJlIFBhcnNlIGZvcm1hdC5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNjaGVtYUNvbnRyb2xsZXIge1xuICBfZGJBZGFwdGVyOiBTdG9yYWdlQWRhcHRlcjtcbiAgZGF0YTogYW55O1xuICBwZXJtczogYW55O1xuICBpbmRleGVzOiBhbnk7XG4gIF9jYWNoZTogYW55O1xuICByZWxvYWREYXRhUHJvbWlzZTogUHJvbWlzZTxhbnk+O1xuXG4gIGNvbnN0cnVjdG9yKGRhdGFiYXNlQWRhcHRlcjogU3RvcmFnZUFkYXB0ZXIsIHNjaGVtYUNhY2hlOiBhbnkpIHtcbiAgICB0aGlzLl9kYkFkYXB0ZXIgPSBkYXRhYmFzZUFkYXB0ZXI7XG4gICAgdGhpcy5fY2FjaGUgPSBzY2hlbWFDYWNoZTtcbiAgICAvLyB0aGlzLmRhdGFbY2xhc3NOYW1lXVtmaWVsZE5hbWVdIHRlbGxzIHlvdSB0aGUgdHlwZSBvZiB0aGF0IGZpZWxkLCBpbiBtb25nbyBmb3JtYXRcbiAgICB0aGlzLmRhdGEgPSB7fTtcbiAgICAvLyB0aGlzLnBlcm1zW2NsYXNzTmFtZV1bb3BlcmF0aW9uXSB0ZWxscyB5b3UgdGhlIGFjbC1zdHlsZSBwZXJtaXNzaW9uc1xuICAgIHRoaXMucGVybXMgPSB7fTtcbiAgICAvLyB0aGlzLmluZGV4ZXNbY2xhc3NOYW1lXVtvcGVyYXRpb25dIHRlbGxzIHlvdSB0aGUgaW5kZXhlc1xuICAgIHRoaXMuaW5kZXhlcyA9IHt9O1xuICB9XG5cbiAgcmVsb2FkRGF0YShvcHRpb25zOiBMb2FkU2NoZW1hT3B0aW9ucyA9IHtjbGVhckNhY2hlOiBmYWxzZX0pOiBQcm9taXNlPGFueT4ge1xuICAgIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgaWYgKG9wdGlvbnMuY2xlYXJDYWNoZSkge1xuICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigoKSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZS5jbGVhcigpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGlmICh0aGlzLnJlbG9hZERhdGFQcm9taXNlICYmICFvcHRpb25zLmNsZWFyQ2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLnJlbG9hZERhdGFQcm9taXNlO1xuICAgIH1cbiAgICB0aGlzLnJlbG9hZERhdGFQcm9taXNlID0gcHJvbWlzZS50aGVuKCgpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmdldEFsbENsYXNzZXMob3B0aW9ucykudGhlbigoYWxsU2NoZW1hcykgPT4ge1xuICAgICAgICBjb25zdCBkYXRhID0ge307XG4gICAgICAgIGNvbnN0IHBlcm1zID0ge307XG4gICAgICAgIGNvbnN0IGluZGV4ZXMgPSB7fTtcbiAgICAgICAgYWxsU2NoZW1hcy5mb3JFYWNoKHNjaGVtYSA9PiB7XG4gICAgICAgICAgZGF0YVtzY2hlbWEuY2xhc3NOYW1lXSA9IGluamVjdERlZmF1bHRTY2hlbWEoc2NoZW1hKS5maWVsZHM7XG4gICAgICAgICAgcGVybXNbc2NoZW1hLmNsYXNzTmFtZV0gPSBzY2hlbWEuY2xhc3NMZXZlbFBlcm1pc3Npb25zO1xuICAgICAgICAgIGluZGV4ZXNbc2NoZW1hLmNsYXNzTmFtZV0gPSBzY2hlbWEuaW5kZXhlcztcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gSW5qZWN0IHRoZSBpbi1tZW1vcnkgY2xhc3Nlc1xuICAgICAgICB2b2xhdGlsZUNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4ge1xuICAgICAgICAgIGNvbnN0IHNjaGVtYSA9IGluamVjdERlZmF1bHRTY2hlbWEoeyBjbGFzc05hbWUsIGZpZWxkczoge30sIGNsYXNzTGV2ZWxQZXJtaXNzaW9uczoge30gfSk7XG4gICAgICAgICAgZGF0YVtjbGFzc05hbWVdID0gc2NoZW1hLmZpZWxkcztcbiAgICAgICAgICBwZXJtc1tjbGFzc05hbWVdID0gc2NoZW1hLmNsYXNzTGV2ZWxQZXJtaXNzaW9ucztcbiAgICAgICAgICBpbmRleGVzW2NsYXNzTmFtZV0gPSBzY2hlbWEuaW5kZXhlcztcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgICAgIHRoaXMucGVybXMgPSBwZXJtcztcbiAgICAgICAgdGhpcy5pbmRleGVzID0gaW5kZXhlcztcbiAgICAgICAgZGVsZXRlIHRoaXMucmVsb2FkRGF0YVByb21pc2U7XG4gICAgICB9LCAoZXJyKSA9PiB7XG4gICAgICAgIHRoaXMuZGF0YSA9IHt9O1xuICAgICAgICB0aGlzLnBlcm1zID0ge307XG4gICAgICAgIHRoaXMuaW5kZXhlcyA9IHt9O1xuICAgICAgICBkZWxldGUgdGhpcy5yZWxvYWREYXRhUHJvbWlzZTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfSlcbiAgICB9KS50aGVuKCgpID0+IHt9KTtcbiAgICByZXR1cm4gdGhpcy5yZWxvYWREYXRhUHJvbWlzZTtcbiAgfVxuXG4gIGdldEFsbENsYXNzZXMob3B0aW9uczogTG9hZFNjaGVtYU9wdGlvbnMgPSB7Y2xlYXJDYWNoZTogZmFsc2V9KTogUHJvbWlzZTxBcnJheTxTY2hlbWE+PiB7XG4gICAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICBpZiAob3B0aW9ucy5jbGVhckNhY2hlKSB7XG4gICAgICBwcm9taXNlID0gdGhpcy5fY2FjaGUuY2xlYXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIHByb21pc2UudGhlbigoKSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGUuZ2V0QWxsQ2xhc3NlcygpXG4gICAgfSkudGhlbigoYWxsQ2xhc3NlcykgPT4ge1xuICAgICAgaWYgKGFsbENsYXNzZXMgJiYgYWxsQ2xhc3Nlcy5sZW5ndGggJiYgIW9wdGlvbnMuY2xlYXJDYWNoZSkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGFsbENsYXNzZXMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX2RiQWRhcHRlci5nZXRBbGxDbGFzc2VzKClcbiAgICAgICAgLnRoZW4oYWxsU2NoZW1hcyA9PiBhbGxTY2hlbWFzLm1hcChpbmplY3REZWZhdWx0U2NoZW1hKSlcbiAgICAgICAgLnRoZW4oYWxsU2NoZW1hcyA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlLnNldEFsbENsYXNzZXMoYWxsU2NoZW1hcykudGhlbigoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWxsU2NoZW1hcztcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICB9KTtcbiAgfVxuXG4gIGdldE9uZVNjaGVtYShjbGFzc05hbWU6IHN0cmluZywgYWxsb3dWb2xhdGlsZUNsYXNzZXM6IGJvb2xlYW4gPSBmYWxzZSwgb3B0aW9uczogTG9hZFNjaGVtYU9wdGlvbnMgPSB7Y2xlYXJDYWNoZTogZmFsc2V9KTogUHJvbWlzZTxTY2hlbWE+IHtcbiAgICBsZXQgcHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuICAgIGlmIChvcHRpb25zLmNsZWFyQ2FjaGUpIHtcbiAgICAgIHByb21pc2UgPSB0aGlzLl9jYWNoZS5jbGVhcigpO1xuICAgIH1cbiAgICByZXR1cm4gcHJvbWlzZS50aGVuKCgpID0+IHtcbiAgICAgIGlmIChhbGxvd1ZvbGF0aWxlQ2xhc3NlcyAmJiB2b2xhdGlsZUNsYXNzZXMuaW5kZXhPZihjbGFzc05hbWUpID4gLTEpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7XG4gICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgIGZpZWxkczogdGhpcy5kYXRhW2NsYXNzTmFtZV0sXG4gICAgICAgICAgY2xhc3NMZXZlbFBlcm1pc3Npb25zOiB0aGlzLnBlcm1zW2NsYXNzTmFtZV0sXG4gICAgICAgICAgaW5kZXhlczogdGhpcy5pbmRleGVzW2NsYXNzTmFtZV1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGUuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSkudGhlbigoY2FjaGVkKSA9PiB7XG4gICAgICAgIGlmIChjYWNoZWQgJiYgIW9wdGlvbnMuY2xlYXJDYWNoZSkge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoY2FjaGVkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fZGJBZGFwdGVyLmdldENsYXNzKGNsYXNzTmFtZSlcbiAgICAgICAgICAudGhlbihpbmplY3REZWZhdWx0U2NoZW1hKVxuICAgICAgICAgIC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jYWNoZS5zZXRPbmVTY2hlbWEoY2xhc3NOYW1lLCByZXN1bHQpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gQ3JlYXRlIGEgbmV3IGNsYXNzIHRoYXQgaW5jbHVkZXMgdGhlIHRocmVlIGRlZmF1bHQgZmllbGRzLlxuICAvLyBBQ0wgaXMgYW4gaW1wbGljaXQgY29sdW1uIHRoYXQgZG9lcyBub3QgZ2V0IGFuIGVudHJ5IGluIHRoZVxuICAvLyBfU0NIRU1BUyBkYXRhYmFzZS4gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZVxuICAvLyBjcmVhdGVkIHNjaGVtYSwgaW4gbW9uZ28gZm9ybWF0LlxuICAvLyBvbiBzdWNjZXNzLCBhbmQgcmVqZWN0cyB3aXRoIGFuIGVycm9yIG9uIGZhaWwuIEVuc3VyZSB5b3VcbiAgLy8gaGF2ZSBhdXRob3JpemF0aW9uIChtYXN0ZXIga2V5LCBvciBjbGllbnQgY2xhc3MgY3JlYXRpb25cbiAgLy8gZW5hYmxlZCkgYmVmb3JlIGNhbGxpbmcgdGhpcyBmdW5jdGlvbi5cbiAgYWRkQ2xhc3NJZk5vdEV4aXN0cyhjbGFzc05hbWU6IHN0cmluZywgZmllbGRzOiBTY2hlbWFGaWVsZHMgPSB7fSwgY2xhc3NMZXZlbFBlcm1pc3Npb25zOiBhbnksIGluZGV4ZXM6IGFueSA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdmFyIHZhbGlkYXRpb25FcnJvciA9IHRoaXMudmFsaWRhdGVOZXdDbGFzcyhjbGFzc05hbWUsIGZpZWxkcywgY2xhc3NMZXZlbFBlcm1pc3Npb25zKTtcbiAgICBpZiAodmFsaWRhdGlvbkVycm9yKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QodmFsaWRhdGlvbkVycm9yKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fZGJBZGFwdGVyLmNyZWF0ZUNsYXNzKGNsYXNzTmFtZSwgY29udmVydFNjaGVtYVRvQWRhcHRlclNjaGVtYSh7IGZpZWxkcywgY2xhc3NMZXZlbFBlcm1pc3Npb25zLCBpbmRleGVzLCBjbGFzc05hbWUgfSkpXG4gICAgICAudGhlbihjb252ZXJ0QWRhcHRlclNjaGVtYVRvUGFyc2VTY2hlbWEpXG4gICAgICAudGhlbigocmVzKSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZS5jbGVhcigpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzKTtcbiAgICAgICAgfSk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgaWYgKGVycm9yICYmIGVycm9yLmNvZGUgPT09IFBhcnNlLkVycm9yLkRVUExJQ0FURV9WQUxVRSkge1xuICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0NMQVNTX05BTUUsIGBDbGFzcyAke2NsYXNzTmFtZX0gYWxyZWFkeSBleGlzdHMuYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgdXBkYXRlQ2xhc3MoY2xhc3NOYW1lOiBzdHJpbmcsIHN1Ym1pdHRlZEZpZWxkczogU2NoZW1hRmllbGRzLCBjbGFzc0xldmVsUGVybWlzc2lvbnM6IGFueSwgaW5kZXhlczogYW55LCBkYXRhYmFzZTogRGF0YWJhc2VDb250cm9sbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKHNjaGVtYSA9PiB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nRmllbGRzID0gc2NoZW1hLmZpZWxkcztcbiAgICAgICAgT2JqZWN0LmtleXMoc3VibWl0dGVkRmllbGRzKS5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgICAgIGNvbnN0IGZpZWxkID0gc3VibWl0dGVkRmllbGRzW25hbWVdO1xuICAgICAgICAgIGlmIChleGlzdGluZ0ZpZWxkc1tuYW1lXSAmJiBmaWVsZC5fX29wICE9PSAnRGVsZXRlJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKDI1NSwgYEZpZWxkICR7bmFtZX0gZXhpc3RzLCBjYW5ub3QgdXBkYXRlLmApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIWV4aXN0aW5nRmllbGRzW25hbWVdICYmIGZpZWxkLl9fb3AgPT09ICdEZWxldGUnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoMjU1LCBgRmllbGQgJHtuYW1lfSBkb2VzIG5vdCBleGlzdCwgY2Fubm90IGRlbGV0ZS5gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRlbGV0ZSBleGlzdGluZ0ZpZWxkcy5fcnBlcm07XG4gICAgICAgIGRlbGV0ZSBleGlzdGluZ0ZpZWxkcy5fd3Blcm07XG4gICAgICAgIGNvbnN0IG5ld1NjaGVtYSA9IGJ1aWxkTWVyZ2VkU2NoZW1hT2JqZWN0KGV4aXN0aW5nRmllbGRzLCBzdWJtaXR0ZWRGaWVsZHMpO1xuICAgICAgICBjb25zdCBkZWZhdWx0RmllbGRzID0gZGVmYXVsdENvbHVtbnNbY2xhc3NOYW1lXSB8fCBkZWZhdWx0Q29sdW1ucy5fRGVmYXVsdDtcbiAgICAgICAgY29uc3QgZnVsbE5ld1NjaGVtYSA9IE9iamVjdC5hc3NpZ24oe30sIG5ld1NjaGVtYSwgZGVmYXVsdEZpZWxkcyk7XG4gICAgICAgIGNvbnN0IHZhbGlkYXRpb25FcnJvciA9IHRoaXMudmFsaWRhdGVTY2hlbWFEYXRhKGNsYXNzTmFtZSwgbmV3U2NoZW1hLCBjbGFzc0xldmVsUGVybWlzc2lvbnMsIE9iamVjdC5rZXlzKGV4aXN0aW5nRmllbGRzKSk7XG4gICAgICAgIGlmICh2YWxpZGF0aW9uRXJyb3IpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IodmFsaWRhdGlvbkVycm9yLmNvZGUsIHZhbGlkYXRpb25FcnJvci5lcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaW5hbGx5IHdlIGhhdmUgY2hlY2tlZCB0byBtYWtlIHN1cmUgdGhlIHJlcXVlc3QgaXMgdmFsaWQgYW5kIHdlIGNhbiBzdGFydCBkZWxldGluZyBmaWVsZHMuXG4gICAgICAgIC8vIERvIGFsbCBkZWxldGlvbnMgZmlyc3QsIHRoZW4gYSBzaW5nbGUgc2F2ZSB0byBfU0NIRU1BIGNvbGxlY3Rpb24gdG8gaGFuZGxlIGFsbCBhZGRpdGlvbnMuXG4gICAgICAgIGNvbnN0IGRlbGV0ZWRGaWVsZHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGNvbnN0IGluc2VydGVkRmllbGRzID0gW107XG4gICAgICAgIE9iamVjdC5rZXlzKHN1Ym1pdHRlZEZpZWxkcykuZm9yRWFjaChmaWVsZE5hbWUgPT4ge1xuICAgICAgICAgIGlmIChzdWJtaXR0ZWRGaWVsZHNbZmllbGROYW1lXS5fX29wID09PSAnRGVsZXRlJykge1xuICAgICAgICAgICAgZGVsZXRlZEZpZWxkcy5wdXNoKGZpZWxkTmFtZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGluc2VydGVkRmllbGRzLnB1c2goZmllbGROYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxldCBkZWxldGVQcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIGlmIChkZWxldGVkRmllbGRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBkZWxldGVQcm9taXNlID0gdGhpcy5kZWxldGVGaWVsZHMoZGVsZXRlZEZpZWxkcywgY2xhc3NOYW1lLCBkYXRhYmFzZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlbGV0ZVByb21pc2UgLy8gRGVsZXRlIEV2ZXJ5dGhpbmdcbiAgICAgICAgICAudGhlbigoKSA9PiB0aGlzLnJlbG9hZERhdGEoeyBjbGVhckNhY2hlOiB0cnVlIH0pKSAvLyBSZWxvYWQgb3VyIFNjaGVtYSwgc28gd2UgaGF2ZSBhbGwgdGhlIG5ldyB2YWx1ZXNcbiAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwcm9taXNlcyA9IGluc2VydGVkRmllbGRzLm1hcChmaWVsZE5hbWUgPT4ge1xuICAgICAgICAgICAgICBjb25zdCB0eXBlID0gc3VibWl0dGVkRmllbGRzW2ZpZWxkTmFtZV07XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmVuZm9yY2VGaWVsZEV4aXN0cyhjbGFzc05hbWUsIGZpZWxkTmFtZSwgdHlwZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAudGhlbigoKSA9PiB0aGlzLnNldFBlcm1pc3Npb25zKGNsYXNzTmFtZSwgY2xhc3NMZXZlbFBlcm1pc3Npb25zLCBuZXdTY2hlbWEpKVxuICAgICAgICAgIC50aGVuKCgpID0+IHRoaXMuX2RiQWRhcHRlci5zZXRJbmRleGVzV2l0aFNjaGVtYUZvcm1hdChjbGFzc05hbWUsIGluZGV4ZXMsIHNjaGVtYS5pbmRleGVzLCBmdWxsTmV3U2NoZW1hKSlcbiAgICAgICAgICAudGhlbigoKSA9PiB0aGlzLnJlbG9hZERhdGEoeyBjbGVhckNhY2hlOiB0cnVlIH0pKVxuICAgICAgICAvL1RPRE86IE1vdmUgdGhpcyBsb2dpYyBpbnRvIHRoZSBkYXRhYmFzZSBhZGFwdGVyXG4gICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVsb2FkZWRTY2hlbWE6IFNjaGVtYSA9IHtcbiAgICAgICAgICAgICAgY2xhc3NOYW1lOiBjbGFzc05hbWUsXG4gICAgICAgICAgICAgIGZpZWxkczogdGhpcy5kYXRhW2NsYXNzTmFtZV0sXG4gICAgICAgICAgICAgIGNsYXNzTGV2ZWxQZXJtaXNzaW9uczogdGhpcy5wZXJtc1tjbGFzc05hbWVdLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4ZXNbY2xhc3NOYW1lXSAmJiBPYmplY3Qua2V5cyh0aGlzLmluZGV4ZXNbY2xhc3NOYW1lXSkubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICAgIHJlbG9hZGVkU2NoZW1hLmluZGV4ZXMgPSB0aGlzLmluZGV4ZXNbY2xhc3NOYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZWxvYWRlZFNjaGVtYTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBpZiAoZXJyb3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0NMQVNTX05BTUUsIGBDbGFzcyAke2NsYXNzTmFtZX0gZG9lcyBub3QgZXhpc3QuYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gIH1cblxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHN1Y2Nlc3NmdWxseSB0byB0aGUgbmV3IHNjaGVtYVxuICAvLyBvYmplY3Qgb3IgZmFpbHMgd2l0aCBhIHJlYXNvbi5cbiAgZW5mb3JjZUNsYXNzRXhpc3RzKGNsYXNzTmFtZTogc3RyaW5nKTogUHJvbWlzZTxTY2hlbWFDb250cm9sbGVyPiB7XG4gICAgaWYgKHRoaXMuZGF0YVtjbGFzc05hbWVdKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMpO1xuICAgIH1cbiAgICAvLyBXZSBkb24ndCBoYXZlIHRoaXMgY2xhc3MuIFVwZGF0ZSB0aGUgc2NoZW1hXG4gICAgcmV0dXJuIHRoaXMuYWRkQ2xhc3NJZk5vdEV4aXN0cyhjbGFzc05hbWUpXG4gICAgLy8gVGhlIHNjaGVtYSB1cGRhdGUgc3VjY2VlZGVkLiBSZWxvYWQgdGhlIHNjaGVtYVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5yZWxvYWREYXRhKHsgY2xlYXJDYWNoZTogdHJ1ZSB9KSlcbiAgICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAvLyBUaGUgc2NoZW1hIHVwZGF0ZSBmYWlsZWQuIFRoaXMgY2FuIGJlIG9rYXkgLSBpdCBtaWdodFxuICAgICAgLy8gaGF2ZSBmYWlsZWQgYmVjYXVzZSB0aGVyZSdzIGEgcmFjZSBjb25kaXRpb24gYW5kIGEgZGlmZmVyZW50XG4gICAgICAvLyBjbGllbnQgaXMgbWFraW5nIHRoZSBleGFjdCBzYW1lIHNjaGVtYSB1cGRhdGUgdGhhdCB3ZSB3YW50LlxuICAgICAgLy8gU28ganVzdCByZWxvYWQgdGhlIHNjaGVtYS5cbiAgICAgICAgcmV0dXJuIHRoaXMucmVsb2FkRGF0YSh7IGNsZWFyQ2FjaGU6IHRydWUgfSk7XG4gICAgICB9KVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgLy8gRW5zdXJlIHRoYXQgdGhlIHNjaGVtYSBub3cgdmFsaWRhdGVzXG4gICAgICAgIGlmICh0aGlzLmRhdGFbY2xhc3NOYW1lXSkge1xuICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sIGBGYWlsZWQgdG8gYWRkICR7Y2xhc3NOYW1lfWApO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmNhdGNoKCgpID0+IHtcbiAgICAgIC8vIFRoZSBzY2hlbWEgc3RpbGwgZG9lc24ndCB2YWxpZGF0ZS4gR2l2ZSB1cFxuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCAnc2NoZW1hIGNsYXNzIG5hbWUgZG9lcyBub3QgcmV2YWxpZGF0ZScpO1xuICAgICAgfSk7XG4gIH1cblxuICB2YWxpZGF0ZU5ld0NsYXNzKGNsYXNzTmFtZTogc3RyaW5nLCBmaWVsZHM6IFNjaGVtYUZpZWxkcyA9IHt9LCBjbGFzc0xldmVsUGVybWlzc2lvbnM6IGFueSk6IGFueSB7XG4gICAgaWYgKHRoaXMuZGF0YVtjbGFzc05hbWVdKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9DTEFTU19OQU1FLCBgQ2xhc3MgJHtjbGFzc05hbWV9IGFscmVhZHkgZXhpc3RzLmApO1xuICAgIH1cbiAgICBpZiAoIWNsYXNzTmFtZUlzVmFsaWQoY2xhc3NOYW1lKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29kZTogUGFyc2UuRXJyb3IuSU5WQUxJRF9DTEFTU19OQU1FLFxuICAgICAgICBlcnJvcjogaW52YWxpZENsYXNzTmFtZU1lc3NhZ2UoY2xhc3NOYW1lKSxcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnZhbGlkYXRlU2NoZW1hRGF0YShjbGFzc05hbWUsIGZpZWxkcywgY2xhc3NMZXZlbFBlcm1pc3Npb25zLCBbXSk7XG4gIH1cblxuICB2YWxpZGF0ZVNjaGVtYURhdGEoY2xhc3NOYW1lOiBzdHJpbmcsIGZpZWxkczogU2NoZW1hRmllbGRzLCBjbGFzc0xldmVsUGVybWlzc2lvbnM6IENsYXNzTGV2ZWxQZXJtaXNzaW9ucywgZXhpc3RpbmdGaWVsZE5hbWVzOiBBcnJheTxzdHJpbmc+KSB7XG4gICAgZm9yIChjb25zdCBmaWVsZE5hbWUgaW4gZmllbGRzKSB7XG4gICAgICBpZiAoZXhpc3RpbmdGaWVsZE5hbWVzLmluZGV4T2YoZmllbGROYW1lKSA8IDApIHtcbiAgICAgICAgaWYgKCFmaWVsZE5hbWVJc1ZhbGlkKGZpZWxkTmFtZSkpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29kZTogUGFyc2UuRXJyb3IuSU5WQUxJRF9LRVlfTkFNRSxcbiAgICAgICAgICAgIGVycm9yOiAnaW52YWxpZCBmaWVsZCBuYW1lOiAnICsgZmllbGROYW1lLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFmaWVsZE5hbWVJc1ZhbGlkRm9yQ2xhc3MoZmllbGROYW1lLCBjbGFzc05hbWUpKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvZGU6IDEzNixcbiAgICAgICAgICAgIGVycm9yOiAnZmllbGQgJyArIGZpZWxkTmFtZSArICcgY2Fubm90IGJlIGFkZGVkJyxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGVycm9yID0gZmllbGRUeXBlSXNJbnZhbGlkKGZpZWxkc1tmaWVsZE5hbWVdKTtcbiAgICAgICAgaWYgKGVycm9yKSByZXR1cm4geyBjb2RlOiBlcnJvci5jb2RlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3QgZmllbGROYW1lIGluIGRlZmF1bHRDb2x1bW5zW2NsYXNzTmFtZV0pIHtcbiAgICAgIGZpZWxkc1tmaWVsZE5hbWVdID0gZGVmYXVsdENvbHVtbnNbY2xhc3NOYW1lXVtmaWVsZE5hbWVdO1xuICAgIH1cblxuICAgIGNvbnN0IGdlb1BvaW50cyA9IE9iamVjdC5rZXlzKGZpZWxkcykuZmlsdGVyKGtleSA9PiBmaWVsZHNba2V5XSAmJiBmaWVsZHNba2V5XS50eXBlID09PSAnR2VvUG9pbnQnKTtcbiAgICBpZiAoZ2VvUG9pbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvZGU6IFBhcnNlLkVycm9yLklOQ09SUkVDVF9UWVBFLFxuICAgICAgICBlcnJvcjogJ2N1cnJlbnRseSwgb25seSBvbmUgR2VvUG9pbnQgZmllbGQgbWF5IGV4aXN0IGluIGFuIG9iamVjdC4gQWRkaW5nICcgKyBnZW9Qb2ludHNbMV0gKyAnIHdoZW4gJyArIGdlb1BvaW50c1swXSArICcgYWxyZWFkeSBleGlzdHMuJyxcbiAgICAgIH07XG4gICAgfVxuICAgIHZhbGlkYXRlQ0xQKGNsYXNzTGV2ZWxQZXJtaXNzaW9ucywgZmllbGRzKTtcbiAgfVxuXG4gIC8vIFNldHMgdGhlIENsYXNzLWxldmVsIHBlcm1pc3Npb25zIGZvciBhIGdpdmVuIGNsYXNzTmFtZSwgd2hpY2ggbXVzdCBleGlzdC5cbiAgc2V0UGVybWlzc2lvbnMoY2xhc3NOYW1lOiBzdHJpbmcsIHBlcm1zOiBhbnksIG5ld1NjaGVtYTogU2NoZW1hRmllbGRzKSB7XG4gICAgaWYgKHR5cGVvZiBwZXJtcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG4gICAgdmFsaWRhdGVDTFAocGVybXMsIG5ld1NjaGVtYSk7XG4gICAgcmV0dXJuIHRoaXMuX2RiQWRhcHRlci5zZXRDbGFzc0xldmVsUGVybWlzc2lvbnMoY2xhc3NOYW1lLCBwZXJtcyk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHN1Y2Nlc3NmdWxseSB0byB0aGUgbmV3IHNjaGVtYVxuICAvLyBvYmplY3QgaWYgdGhlIHByb3ZpZGVkIGNsYXNzTmFtZS1maWVsZE5hbWUtdHlwZSB0dXBsZSBpcyB2YWxpZC5cbiAgLy8gVGhlIGNsYXNzTmFtZSBtdXN0IGFscmVhZHkgYmUgdmFsaWRhdGVkLlxuICAvLyBJZiAnZnJlZXplJyBpcyB0cnVlLCByZWZ1c2UgdG8gdXBkYXRlIHRoZSBzY2hlbWEgZm9yIHRoaXMgZmllbGQuXG4gIGVuZm9yY2VGaWVsZEV4aXN0cyhjbGFzc05hbWU6IHN0cmluZywgZmllbGROYW1lOiBzdHJpbmcsIHR5cGU6IHN0cmluZyB8IFNjaGVtYUZpZWxkKSB7XG4gICAgaWYgKGZpZWxkTmFtZS5pbmRleE9mKFwiLlwiKSA+IDApIHtcbiAgICAgIC8vIHN1YmRvY3VtZW50IGtleSAoeC55KSA9PiBvayBpZiB4IGlzIG9mIHR5cGUgJ29iamVjdCdcbiAgICAgIGZpZWxkTmFtZSA9IGZpZWxkTmFtZS5zcGxpdChcIi5cIilbIDAgXTtcbiAgICAgIHR5cGUgPSAnT2JqZWN0JztcbiAgICB9XG4gICAgaWYgKCFmaWVsZE5hbWVJc1ZhbGlkKGZpZWxkTmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLCBgSW52YWxpZCBmaWVsZCBuYW1lOiAke2ZpZWxkTmFtZX0uYCk7XG4gICAgfVxuXG4gICAgLy8gSWYgc29tZW9uZSB0cmllcyB0byBjcmVhdGUgYSBuZXcgZmllbGQgd2l0aCBudWxsL3VuZGVmaW5lZCBhcyB0aGUgdmFsdWUsIHJldHVybjtcbiAgICBpZiAoIXR5cGUpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucmVsb2FkRGF0YSgpLnRoZW4oKCkgPT4ge1xuICAgICAgY29uc3QgZXhwZWN0ZWRUeXBlID0gdGhpcy5nZXRFeHBlY3RlZFR5cGUoY2xhc3NOYW1lLCBmaWVsZE5hbWUpO1xuICAgICAgaWYgKHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICB0eXBlID0geyB0eXBlIH07XG4gICAgICB9XG5cbiAgICAgIGlmIChleHBlY3RlZFR5cGUpIHtcbiAgICAgICAgaWYgKCFkYlR5cGVNYXRjaGVzT2JqZWN0VHlwZShleHBlY3RlZFR5cGUsIHR5cGUpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5DT1JSRUNUX1RZUEUsXG4gICAgICAgICAgICBgc2NoZW1hIG1pc21hdGNoIGZvciAke2NsYXNzTmFtZX0uJHtmaWVsZE5hbWV9OyBleHBlY3RlZCAke3R5cGVUb1N0cmluZyhleHBlY3RlZFR5cGUpfSBidXQgZ290ICR7dHlwZVRvU3RyaW5nKHR5cGUpfWBcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5fZGJBZGFwdGVyLmFkZEZpZWxkSWZOb3RFeGlzdHMoY2xhc3NOYW1lLCBmaWVsZE5hbWUsIHR5cGUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAvLyBUaGUgdXBkYXRlIHN1Y2NlZWRlZC4gUmVsb2FkIHRoZSBzY2hlbWFcbiAgICAgICAgcmV0dXJuIHRoaXMucmVsb2FkRGF0YSh7IGNsZWFyQ2FjaGU6IHRydWUgfSk7XG4gICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgaWYgKGVycm9yLmNvZGUgPT0gUGFyc2UuRXJyb3IuSU5DT1JSRUNUX1RZUEUpIHtcbiAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCB3ZSB0aHJvdyBlcnJvcnMgd2hlbiBpdCBpcyBhcHByb3ByaWF0ZSB0byBkbyBzby5cbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgICAvLyBUaGUgdXBkYXRlIGZhaWxlZC4gVGhpcyBjYW4gYmUgb2theSAtIGl0IG1pZ2h0IGhhdmUgYmVlbiBhIHJhY2VcbiAgICAgICAgLy8gY29uZGl0aW9uIHdoZXJlIGFub3RoZXIgY2xpZW50IHVwZGF0ZWQgdGhlIHNjaGVtYSBpbiB0aGUgc2FtZVxuICAgICAgICAvLyB3YXkgdGhhdCB3ZSB3YW50ZWQgdG8uIFNvLCBqdXN0IHJlbG9hZCB0aGUgc2NoZW1hXG4gICAgICAgIHJldHVybiB0aGlzLnJlbG9hZERhdGEoeyBjbGVhckNhY2hlOiB0cnVlIH0pO1xuICAgICAgfSkudGhlbigoKSA9PiB7XG4gICAgICAgIC8vIEVuc3VyZSB0aGF0IHRoZSBzY2hlbWEgbm93IHZhbGlkYXRlc1xuICAgICAgICBjb25zdCBleHBlY3RlZFR5cGUgPSB0aGlzLmdldEV4cGVjdGVkVHlwZShjbGFzc05hbWUsIGZpZWxkTmFtZSk7XG4gICAgICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0eXBlID0geyB0eXBlIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFleHBlY3RlZFR5cGUgfHwgIWRiVHlwZU1hdGNoZXNPYmplY3RUeXBlKGV4cGVjdGVkVHlwZSwgdHlwZSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCBgQ291bGQgbm90IGFkZCBmaWVsZCAke2ZpZWxkTmFtZX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBSZW1vdmUgdGhlIGNhY2hlZCBzY2hlbWFcbiAgICAgICAgdGhpcy5fY2FjaGUuY2xlYXIoKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIG1haW50YWluIGNvbXBhdGliaWxpdHlcbiAgZGVsZXRlRmllbGQoZmllbGROYW1lOiBzdHJpbmcsIGNsYXNzTmFtZTogc3RyaW5nLCBkYXRhYmFzZTogRGF0YWJhc2VDb250cm9sbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZGVsZXRlRmllbGRzKFtmaWVsZE5hbWVdLCBjbGFzc05hbWUsIGRhdGFiYXNlKTtcbiAgfVxuXG4gIC8vIERlbGV0ZSBmaWVsZHMsIGFuZCByZW1vdmUgdGhhdCBkYXRhIGZyb20gYWxsIG9iamVjdHMuIFRoaXMgaXMgaW50ZW5kZWRcbiAgLy8gdG8gcmVtb3ZlIHVudXNlZCBmaWVsZHMsIGlmIG90aGVyIHdyaXRlcnMgYXJlIHdyaXRpbmcgb2JqZWN0cyB0aGF0IGluY2x1ZGVcbiAgLy8gdGhpcyBmaWVsZCwgdGhlIGZpZWxkIG1heSByZWFwcGVhci4gUmV0dXJucyBhIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoXG4gIC8vIG5vIG9iamVjdCBvbiBzdWNjZXNzLCBvciByZWplY3RzIHdpdGggeyBjb2RlLCBlcnJvciB9IG9uIGZhaWx1cmUuXG4gIC8vIFBhc3NpbmcgdGhlIGRhdGFiYXNlIGFuZCBwcmVmaXggaXMgbmVjZXNzYXJ5IGluIG9yZGVyIHRvIGRyb3AgcmVsYXRpb24gY29sbGVjdGlvbnNcbiAgLy8gYW5kIHJlbW92ZSBmaWVsZHMgZnJvbSBvYmplY3RzLiBJZGVhbGx5IHRoZSBkYXRhYmFzZSB3b3VsZCBiZWxvbmcgdG9cbiAgLy8gYSBkYXRhYmFzZSBhZGFwdGVyIGFuZCB0aGlzIGZ1bmN0aW9uIHdvdWxkIGNsb3NlIG92ZXIgaXQgb3IgYWNjZXNzIGl0IHZpYSBtZW1iZXIuXG4gIGRlbGV0ZUZpZWxkcyhmaWVsZE5hbWVzOiBBcnJheTxzdHJpbmc+LCBjbGFzc05hbWU6IHN0cmluZywgZGF0YWJhc2U6IERhdGFiYXNlQ29udHJvbGxlcikge1xuICAgIGlmICghY2xhc3NOYW1lSXNWYWxpZChjbGFzc05hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9DTEFTU19OQU1FLCBpbnZhbGlkQ2xhc3NOYW1lTWVzc2FnZShjbGFzc05hbWUpKTtcbiAgICB9XG5cbiAgICBmaWVsZE5hbWVzLmZvckVhY2goZmllbGROYW1lID0+IHtcbiAgICAgIGlmICghZmllbGROYW1lSXNWYWxpZChmaWVsZE5hbWUpKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLCBgaW52YWxpZCBmaWVsZCBuYW1lOiAke2ZpZWxkTmFtZX1gKTtcbiAgICAgIH1cbiAgICAgIC8vRG9uJ3QgYWxsb3cgZGVsZXRpbmcgdGhlIGRlZmF1bHQgZmllbGRzLlxuICAgICAgaWYgKCFmaWVsZE5hbWVJc1ZhbGlkRm9yQ2xhc3MoZmllbGROYW1lLCBjbGFzc05hbWUpKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcigxMzYsIGBmaWVsZCAke2ZpZWxkTmFtZX0gY2Fubm90IGJlIGNoYW5nZWRgKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLmdldE9uZVNjaGVtYShjbGFzc05hbWUsIGZhbHNlLCB7Y2xlYXJDYWNoZTogdHJ1ZX0pXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBpZiAoZXJyb3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0NMQVNTX05BTUUsIGBDbGFzcyAke2NsYXNzTmFtZX0gZG9lcyBub3QgZXhpc3QuYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAudGhlbihzY2hlbWEgPT4ge1xuICAgICAgICBmaWVsZE5hbWVzLmZvckVhY2goZmllbGROYW1lID0+IHtcbiAgICAgICAgICBpZiAoIXNjaGVtYS5maWVsZHNbZmllbGROYW1lXSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKDI1NSwgYEZpZWxkICR7ZmllbGROYW1lfSBkb2VzIG5vdCBleGlzdCwgY2Fubm90IGRlbGV0ZS5gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHNjaGVtYUZpZWxkcyA9IHsgLi4uc2NoZW1hLmZpZWxkcyB9O1xuICAgICAgICByZXR1cm4gZGF0YWJhc2UuYWRhcHRlci5kZWxldGVGaWVsZHMoY2xhc3NOYW1lLCBzY2hlbWEsIGZpZWxkTmFtZXMpXG4gICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGZpZWxkTmFtZXMubWFwKGZpZWxkTmFtZSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGZpZWxkID0gc2NoZW1hRmllbGRzW2ZpZWxkTmFtZV07XG4gICAgICAgICAgICAgIGlmIChmaWVsZCAmJiBmaWVsZC50eXBlID09PSAnUmVsYXRpb24nKSB7XG4gICAgICAgICAgICAgIC8vRm9yIHJlbGF0aW9ucywgZHJvcCB0aGUgX0pvaW4gdGFibGVcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YWJhc2UuYWRhcHRlci5kZWxldGVDbGFzcyhgX0pvaW46JHtmaWVsZE5hbWV9OiR7Y2xhc3NOYW1lfWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICB0aGlzLl9jYWNoZS5jbGVhcigpO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBWYWxpZGF0ZXMgYW4gb2JqZWN0IHByb3ZpZGVkIGluIFJFU1QgZm9ybWF0LlxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRoZSBuZXcgc2NoZW1hIGlmIHRoaXMgb2JqZWN0IGlzXG4gIC8vIHZhbGlkLlxuICB2YWxpZGF0ZU9iamVjdChjbGFzc05hbWU6IHN0cmluZywgb2JqZWN0OiBhbnksIHF1ZXJ5OiBhbnkpIHtcbiAgICBsZXQgZ2VvY291bnQgPSAwO1xuICAgIGxldCBwcm9taXNlID0gdGhpcy5lbmZvcmNlQ2xhc3NFeGlzdHMoY2xhc3NOYW1lKTtcbiAgICBmb3IgKGNvbnN0IGZpZWxkTmFtZSBpbiBvYmplY3QpIHtcbiAgICAgIGlmIChvYmplY3RbZmllbGROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgZXhwZWN0ZWQgPSBnZXRUeXBlKG9iamVjdFtmaWVsZE5hbWVdKTtcbiAgICAgIGlmIChleHBlY3RlZCA9PT0gJ0dlb1BvaW50Jykge1xuICAgICAgICBnZW9jb3VudCsrO1xuICAgICAgfVxuICAgICAgaWYgKGdlb2NvdW50ID4gMSkge1xuICAgICAgICAvLyBNYWtlIHN1cmUgYWxsIGZpZWxkIHZhbGlkYXRpb24gb3BlcmF0aW9ucyBydW4gYmVmb3JlIHdlIHJldHVybi5cbiAgICAgICAgLy8gSWYgbm90IC0gd2UgYXJlIGNvbnRpbnVpbmcgdG8gcnVuIGxvZ2ljLCBidXQgYWxyZWFkeSBwcm92aWRlZCByZXNwb25zZSBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5DT1JSRUNUX1RZUEUsXG4gICAgICAgICAgICAndGhlcmUgY2FuIG9ubHkgYmUgb25lIGdlb3BvaW50IGZpZWxkIGluIGEgY2xhc3MnKSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKCFleHBlY3RlZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChmaWVsZE5hbWUgPT09ICdBQ0wnKSB7XG4gICAgICAgIC8vIEV2ZXJ5IG9iamVjdCBoYXMgQUNMIGltcGxpY2l0bHkuXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKHNjaGVtYSA9PiBzY2hlbWEuZW5mb3JjZUZpZWxkRXhpc3RzKGNsYXNzTmFtZSwgZmllbGROYW1lLCBleHBlY3RlZCkpO1xuICAgIH1cbiAgICBwcm9taXNlID0gdGhlblZhbGlkYXRlUmVxdWlyZWRDb2x1bW5zKHByb21pc2UsIGNsYXNzTmFtZSwgb2JqZWN0LCBxdWVyeSk7XG4gICAgcmV0dXJuIHByb21pc2U7XG4gIH1cblxuICAvLyBWYWxpZGF0ZXMgdGhhdCBhbGwgdGhlIHByb3BlcnRpZXMgYXJlIHNldCBmb3IgdGhlIG9iamVjdFxuICB2YWxpZGF0ZVJlcXVpcmVkQ29sdW1ucyhjbGFzc05hbWU6IHN0cmluZywgb2JqZWN0OiBhbnksIHF1ZXJ5OiBhbnkpIHtcbiAgICBjb25zdCBjb2x1bW5zID0gcmVxdWlyZWRDb2x1bW5zW2NsYXNzTmFtZV07XG4gICAgaWYgKCFjb2x1bW5zIHx8IGNvbHVtbnMubGVuZ3RoID09IDApIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcyk7XG4gICAgfVxuXG4gICAgY29uc3QgbWlzc2luZ0NvbHVtbnMgPSBjb2x1bW5zLmZpbHRlcihmdW5jdGlvbihjb2x1bW4pe1xuICAgICAgaWYgKHF1ZXJ5ICYmIHF1ZXJ5Lm9iamVjdElkKSB7XG4gICAgICAgIGlmIChvYmplY3RbY29sdW1uXSAmJiB0eXBlb2Ygb2JqZWN0W2NvbHVtbl0gPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAvLyBUcnlpbmcgdG8gZGVsZXRlIGEgcmVxdWlyZWQgY29sdW1uXG4gICAgICAgICAgcmV0dXJuIG9iamVjdFtjb2x1bW5dLl9fb3AgPT0gJ0RlbGV0ZSc7XG4gICAgICAgIH1cbiAgICAgICAgLy8gTm90IHRyeWluZyB0byBkbyBhbnl0aGluZyB0aGVyZVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gIW9iamVjdFtjb2x1bW5dXG4gICAgfSk7XG5cbiAgICBpZiAobWlzc2luZ0NvbHVtbnMubGVuZ3RoID4gMCkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICBQYXJzZS5FcnJvci5JTkNPUlJFQ1RfVFlQRSxcbiAgICAgICAgbWlzc2luZ0NvbHVtbnNbMF0gKyAnIGlzIHJlcXVpcmVkLicpO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMpO1xuICB9XG5cbiAgLy8gVmFsaWRhdGVzIHRoZSBiYXNlIENMUCBmb3IgYW4gb3BlcmF0aW9uXG4gIHRlc3RCYXNlQ0xQKGNsYXNzTmFtZTogc3RyaW5nLCBhY2xHcm91cDogc3RyaW5nW10sIG9wZXJhdGlvbjogc3RyaW5nKSB7XG4gICAgaWYgKCF0aGlzLnBlcm1zW2NsYXNzTmFtZV0gfHwgIXRoaXMucGVybXNbY2xhc3NOYW1lXVtvcGVyYXRpb25dKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY29uc3QgY2xhc3NQZXJtcyA9IHRoaXMucGVybXNbY2xhc3NOYW1lXTtcbiAgICBjb25zdCBwZXJtcyA9IGNsYXNzUGVybXNbb3BlcmF0aW9uXTtcbiAgICAvLyBIYW5kbGUgdGhlIHB1YmxpYyBzY2VuYXJpbyBxdWlja2x5XG4gICAgaWYgKHBlcm1zWycqJ10pIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICAvLyBDaGVjayBwZXJtaXNzaW9ucyBhZ2FpbnN0IHRoZSBhY2xHcm91cCBwcm92aWRlZCAoYXJyYXkgb2YgdXNlcklkL3JvbGVzKVxuICAgIGlmIChhY2xHcm91cC5zb21lKGFjbCA9PiB7IHJldHVybiBwZXJtc1thY2xdID09PSB0cnVlIH0pKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gVmFsaWRhdGVzIGFuIG9wZXJhdGlvbiBwYXNzZXMgY2xhc3MtbGV2ZWwtcGVybWlzc2lvbnMgc2V0IGluIHRoZSBzY2hlbWFcbiAgdmFsaWRhdGVQZXJtaXNzaW9uKGNsYXNzTmFtZTogc3RyaW5nLCBhY2xHcm91cDogc3RyaW5nW10sIG9wZXJhdGlvbjogc3RyaW5nKSB7XG5cbiAgICBpZiAodGhpcy50ZXN0QmFzZUNMUChjbGFzc05hbWUsIGFjbEdyb3VwLCBvcGVyYXRpb24pKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnBlcm1zW2NsYXNzTmFtZV0gfHwgIXRoaXMucGVybXNbY2xhc3NOYW1lXVtvcGVyYXRpb25dKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY29uc3QgY2xhc3NQZXJtcyA9IHRoaXMucGVybXNbY2xhc3NOYW1lXTtcbiAgICBjb25zdCBwZXJtcyA9IGNsYXNzUGVybXNbb3BlcmF0aW9uXTtcblxuICAgIC8vIElmIG9ubHkgZm9yIGF1dGhlbnRpY2F0ZWQgdXNlcnNcbiAgICAvLyBtYWtlIHN1cmUgd2UgaGF2ZSBhbiBhY2xHcm91cFxuICAgIGlmIChwZXJtc1sncmVxdWlyZXNBdXRoZW50aWNhdGlvbiddKSB7XG4gICAgICAvLyBJZiBhY2xHcm91cCBoYXMgKiAocHVibGljKVxuICAgICAgaWYgKCFhY2xHcm91cCB8fCBhY2xHcm91cC5sZW5ndGggPT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuT0JKRUNUX05PVF9GT1VORCxcbiAgICAgICAgICAnUGVybWlzc2lvbiBkZW5pZWQsIHVzZXIgbmVlZHMgdG8gYmUgYXV0aGVudGljYXRlZC4nKTtcbiAgICAgIH0gZWxzZSBpZiAoYWNsR3JvdXAuaW5kZXhPZignKicpID4gLTEgJiYgYWNsR3JvdXAubGVuZ3RoID09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsXG4gICAgICAgICAgJ1Blcm1pc3Npb24gZGVuaWVkLCB1c2VyIG5lZWRzIHRvIGJlIGF1dGhlbnRpY2F0ZWQuJyk7XG4gICAgICB9XG4gICAgICAvLyByZXF1aXJlc0F1dGhlbnRpY2F0aW9uIHBhc3NlZCwganVzdCBtb3ZlIGZvcndhcmRcbiAgICAgIC8vIHByb2JhYmx5IHdvdWxkIGJlIHdpc2UgYXQgc29tZSBwb2ludCB0byByZW5hbWUgdG8gJ2F1dGhlbnRpY2F0ZWRVc2VyJ1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIC8vIE5vIG1hdGNoaW5nIENMUCwgbGV0J3MgY2hlY2sgdGhlIFBvaW50ZXIgcGVybWlzc2lvbnNcbiAgICAvLyBBbmQgaGFuZGxlIHRob3NlIGxhdGVyXG4gICAgY29uc3QgcGVybWlzc2lvbkZpZWxkID0gWydnZXQnLCAnZmluZCcsICdjb3VudCddLmluZGV4T2Yob3BlcmF0aW9uKSA+IC0xID8gJ3JlYWRVc2VyRmllbGRzJyA6ICd3cml0ZVVzZXJGaWVsZHMnO1xuXG4gICAgLy8gUmVqZWN0IGNyZWF0ZSB3aGVuIHdyaXRlIGxvY2tkb3duXG4gICAgaWYgKHBlcm1pc3Npb25GaWVsZCA9PSAnd3JpdGVVc2VyRmllbGRzJyAmJiBvcGVyYXRpb24gPT0gJ2NyZWF0ZScpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PUEVSQVRJT05fRk9SQklEREVOLFxuICAgICAgICBgUGVybWlzc2lvbiBkZW5pZWQgZm9yIGFjdGlvbiAke29wZXJhdGlvbn0gb24gY2xhc3MgJHtjbGFzc05hbWV9LmApO1xuICAgIH1cblxuICAgIC8vIFByb2Nlc3MgdGhlIHJlYWRVc2VyRmllbGRzIGxhdGVyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoY2xhc3NQZXJtc1twZXJtaXNzaW9uRmllbGRdKSAmJiBjbGFzc1Blcm1zW3Blcm1pc3Npb25GaWVsZF0ubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuT1BFUkFUSU9OX0ZPUkJJRERFTixcbiAgICAgIGBQZXJtaXNzaW9uIGRlbmllZCBmb3IgYWN0aW9uICR7b3BlcmF0aW9ufSBvbiBjbGFzcyAke2NsYXNzTmFtZX0uYCk7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRoZSBleHBlY3RlZCB0eXBlIGZvciBhIGNsYXNzTmFtZStrZXkgY29tYmluYXRpb25cbiAgLy8gb3IgdW5kZWZpbmVkIGlmIHRoZSBzY2hlbWEgaXMgbm90IHNldFxuICBnZXRFeHBlY3RlZFR5cGUoY2xhc3NOYW1lOiBzdHJpbmcsIGZpZWxkTmFtZTogc3RyaW5nKTogPyhTY2hlbWFGaWVsZCB8IHN0cmluZykge1xuICAgIGlmICh0aGlzLmRhdGEgJiYgdGhpcy5kYXRhW2NsYXNzTmFtZV0pIHtcbiAgICAgIGNvbnN0IGV4cGVjdGVkVHlwZSA9IHRoaXMuZGF0YVtjbGFzc05hbWVdW2ZpZWxkTmFtZV1cbiAgICAgIHJldHVybiBleHBlY3RlZFR5cGUgPT09ICdtYXAnID8gJ09iamVjdCcgOiBleHBlY3RlZFR5cGU7XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBDaGVja3MgaWYgYSBnaXZlbiBjbGFzcyBpcyBpbiB0aGUgc2NoZW1hLlxuICBoYXNDbGFzcyhjbGFzc05hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLnJlbG9hZERhdGEoKS50aGVuKCgpID0+ICEhKHRoaXMuZGF0YVtjbGFzc05hbWVdKSk7XG4gIH1cbn1cblxuLy8gUmV0dXJucyBhIHByb21pc2UgZm9yIGEgbmV3IFNjaGVtYS5cbmNvbnN0IGxvYWQgPSAoZGJBZGFwdGVyOiBTdG9yYWdlQWRhcHRlciwgc2NoZW1hQ2FjaGU6IGFueSwgb3B0aW9uczogYW55KTogUHJvbWlzZTxTY2hlbWFDb250cm9sbGVyPiA9PiB7XG4gIGNvbnN0IHNjaGVtYSA9IG5ldyBTY2hlbWFDb250cm9sbGVyKGRiQWRhcHRlciwgc2NoZW1hQ2FjaGUpO1xuICByZXR1cm4gc2NoZW1hLnJlbG9hZERhdGEob3B0aW9ucykudGhlbigoKSA9PiBzY2hlbWEpO1xufVxuXG4vLyBCdWlsZHMgYSBuZXcgc2NoZW1hIChpbiBzY2hlbWEgQVBJIHJlc3BvbnNlIGZvcm1hdCkgb3V0IG9mIGFuXG4vLyBleGlzdGluZyBtb25nbyBzY2hlbWEgKyBhIHNjaGVtYXMgQVBJIHB1dCByZXF1ZXN0LiBUaGlzIHJlc3BvbnNlXG4vLyBkb2VzIG5vdCBpbmNsdWRlIHRoZSBkZWZhdWx0IGZpZWxkcywgYXMgaXQgaXMgaW50ZW5kZWQgdG8gYmUgcGFzc2VkXG4vLyB0byBtb25nb1NjaGVtYUZyb21GaWVsZHNBbmRDbGFzc05hbWUuIE5vIHZhbGlkYXRpb24gaXMgZG9uZSBoZXJlLCBpdFxuLy8gaXMgZG9uZSBpbiBtb25nb1NjaGVtYUZyb21GaWVsZHNBbmRDbGFzc05hbWUuXG5mdW5jdGlvbiBidWlsZE1lcmdlZFNjaGVtYU9iamVjdChleGlzdGluZ0ZpZWxkczogU2NoZW1hRmllbGRzLCBwdXRSZXF1ZXN0OiBhbnkpOiBTY2hlbWFGaWVsZHMge1xuICBjb25zdCBuZXdTY2hlbWEgPSB7fTtcbiAgLy8gQGZsb3ctZGlzYWJsZS1uZXh0XG4gIGNvbnN0IHN5c1NjaGVtYUZpZWxkID0gT2JqZWN0LmtleXMoZGVmYXVsdENvbHVtbnMpLmluZGV4T2YoZXhpc3RpbmdGaWVsZHMuX2lkKSA9PT0gLTEgPyBbXSA6IE9iamVjdC5rZXlzKGRlZmF1bHRDb2x1bW5zW2V4aXN0aW5nRmllbGRzLl9pZF0pO1xuICBmb3IgKGNvbnN0IG9sZEZpZWxkIGluIGV4aXN0aW5nRmllbGRzKSB7XG4gICAgaWYgKG9sZEZpZWxkICE9PSAnX2lkJyAmJiBvbGRGaWVsZCAhPT0gJ0FDTCcgJiYgIG9sZEZpZWxkICE9PSAndXBkYXRlZEF0JyAmJiBvbGRGaWVsZCAhPT0gJ2NyZWF0ZWRBdCcgJiYgb2xkRmllbGQgIT09ICdvYmplY3RJZCcpIHtcbiAgICAgIGlmIChzeXNTY2hlbWFGaWVsZC5sZW5ndGggPiAwICYmIHN5c1NjaGVtYUZpZWxkLmluZGV4T2Yob2xkRmllbGQpICE9PSAtMSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGZpZWxkSXNEZWxldGVkID0gcHV0UmVxdWVzdFtvbGRGaWVsZF0gJiYgcHV0UmVxdWVzdFtvbGRGaWVsZF0uX19vcCA9PT0gJ0RlbGV0ZSdcbiAgICAgIGlmICghZmllbGRJc0RlbGV0ZWQpIHtcbiAgICAgICAgbmV3U2NoZW1hW29sZEZpZWxkXSA9IGV4aXN0aW5nRmllbGRzW29sZEZpZWxkXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBuZXdGaWVsZCBpbiBwdXRSZXF1ZXN0KSB7XG4gICAgaWYgKG5ld0ZpZWxkICE9PSAnb2JqZWN0SWQnICYmIHB1dFJlcXVlc3RbbmV3RmllbGRdLl9fb3AgIT09ICdEZWxldGUnKSB7XG4gICAgICBpZiAoc3lzU2NoZW1hRmllbGQubGVuZ3RoID4gMCAmJiBzeXNTY2hlbWFGaWVsZC5pbmRleE9mKG5ld0ZpZWxkKSAhPT0gLTEpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBuZXdTY2hlbWFbbmV3RmllbGRdID0gcHV0UmVxdWVzdFtuZXdGaWVsZF07XG4gICAgfVxuICB9XG4gIHJldHVybiBuZXdTY2hlbWE7XG59XG5cbi8vIEdpdmVuIGEgc2NoZW1hIHByb21pc2UsIGNvbnN0cnVjdCBhbm90aGVyIHNjaGVtYSBwcm9taXNlIHRoYXRcbi8vIHZhbGlkYXRlcyB0aGlzIGZpZWxkIG9uY2UgdGhlIHNjaGVtYSBsb2Fkcy5cbmZ1bmN0aW9uIHRoZW5WYWxpZGF0ZVJlcXVpcmVkQ29sdW1ucyhzY2hlbWFQcm9taXNlLCBjbGFzc05hbWUsIG9iamVjdCwgcXVlcnkpIHtcbiAgcmV0dXJuIHNjaGVtYVByb21pc2UudGhlbigoc2NoZW1hKSA9PiB7XG4gICAgcmV0dXJuIHNjaGVtYS52YWxpZGF0ZVJlcXVpcmVkQ29sdW1ucyhjbGFzc05hbWUsIG9iamVjdCwgcXVlcnkpO1xuICB9KTtcbn1cblxuLy8gR2V0cyB0aGUgdHlwZSBmcm9tIGEgUkVTVCBBUEkgZm9ybWF0dGVkIG9iamVjdCwgd2hlcmUgJ3R5cGUnIGlzXG4vLyBleHRlbmRlZCBwYXN0IGphdmFzY3JpcHQgdHlwZXMgdG8gaW5jbHVkZSB0aGUgcmVzdCBvZiB0aGUgUGFyc2Vcbi8vIHR5cGUgc3lzdGVtLlxuLy8gVGhlIG91dHB1dCBzaG91bGQgYmUgYSB2YWxpZCBzY2hlbWEgdmFsdWUuXG4vLyBUT0RPOiBlbnN1cmUgdGhhdCB0aGlzIGlzIGNvbXBhdGlibGUgd2l0aCB0aGUgZm9ybWF0IHVzZWQgaW4gT3BlbiBEQlxuZnVuY3Rpb24gZ2V0VHlwZShvYmo6IGFueSk6ID8oU2NoZW1hRmllbGQgfCBzdHJpbmcpIHtcbiAgY29uc3QgdHlwZSA9IHR5cGVvZiBvYmo7XG4gIHN3aXRjaCh0eXBlKSB7XG4gIGNhc2UgJ2Jvb2xlYW4nOlxuICAgIHJldHVybiAnQm9vbGVhbic7XG4gIGNhc2UgJ3N0cmluZyc6XG4gICAgcmV0dXJuICdTdHJpbmcnO1xuICBjYXNlICdudW1iZXInOlxuICAgIHJldHVybiAnTnVtYmVyJztcbiAgY2FzZSAnbWFwJzpcbiAgY2FzZSAnb2JqZWN0JzpcbiAgICBpZiAoIW9iaikge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGdldE9iamVjdFR5cGUob2JqKTtcbiAgY2FzZSAnZnVuY3Rpb24nOlxuICBjYXNlICdzeW1ib2wnOlxuICBjYXNlICd1bmRlZmluZWQnOlxuICBkZWZhdWx0OlxuICAgIHRocm93ICdiYWQgb2JqOiAnICsgb2JqO1xuICB9XG59XG5cbi8vIFRoaXMgZ2V0cyB0aGUgdHlwZSBmb3Igbm9uLUpTT04gdHlwZXMgbGlrZSBwb2ludGVycyBhbmQgZmlsZXMsIGJ1dFxuLy8gYWxzbyBnZXRzIHRoZSBhcHByb3ByaWF0ZSB0eXBlIGZvciAkIG9wZXJhdG9ycy5cbi8vIFJldHVybnMgbnVsbCBpZiB0aGUgdHlwZSBpcyB1bmtub3duLlxuZnVuY3Rpb24gZ2V0T2JqZWN0VHlwZShvYmopOiA/KFNjaGVtYUZpZWxkIHwgc3RyaW5nKSB7XG4gIGlmIChvYmogaW5zdGFuY2VvZiBBcnJheSkge1xuICAgIHJldHVybiAnQXJyYXknO1xuICB9XG4gIGlmIChvYmouX190eXBlKXtcbiAgICBzd2l0Y2gob2JqLl9fdHlwZSkge1xuICAgIGNhc2UgJ1BvaW50ZXInIDpcbiAgICAgIGlmKG9iai5jbGFzc05hbWUpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0eXBlOiAnUG9pbnRlcicsXG4gICAgICAgICAgdGFyZ2V0Q2xhc3M6IG9iai5jbGFzc05hbWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnUmVsYXRpb24nIDpcbiAgICAgIGlmKG9iai5jbGFzc05hbWUpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0eXBlOiAnUmVsYXRpb24nLFxuICAgICAgICAgIHRhcmdldENsYXNzOiBvYmouY2xhc3NOYW1lXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0ZpbGUnIDpcbiAgICAgIGlmKG9iai5uYW1lKSB7XG4gICAgICAgIHJldHVybiAnRmlsZSc7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdEYXRlJyA6XG4gICAgICBpZihvYmouaXNvKSB7XG4gICAgICAgIHJldHVybiAnRGF0ZSc7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdHZW9Qb2ludCcgOlxuICAgICAgaWYob2JqLmxhdGl0dWRlICE9IG51bGwgJiYgb2JqLmxvbmdpdHVkZSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiAnR2VvUG9pbnQnO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQnl0ZXMnIDpcbiAgICAgIGlmKG9iai5iYXNlNjQpIHtcbiAgICAgICAgcmV0dXJuICdCeXRlcyc7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdQb2x5Z29uJyA6XG4gICAgICBpZihvYmouY29vcmRpbmF0ZXMpIHtcbiAgICAgICAgcmV0dXJuICdQb2x5Z29uJztcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5DT1JSRUNUX1RZUEUsIFwiVGhpcyBpcyBub3QgYSB2YWxpZCBcIiArIG9iai5fX3R5cGUpO1xuICB9XG4gIGlmIChvYmpbJyRuZSddKSB7XG4gICAgcmV0dXJuIGdldE9iamVjdFR5cGUob2JqWyckbmUnXSk7XG4gIH1cbiAgaWYgKG9iai5fX29wKSB7XG4gICAgc3dpdGNoKG9iai5fX29wKSB7XG4gICAgY2FzZSAnSW5jcmVtZW50JzpcbiAgICAgIHJldHVybiAnTnVtYmVyJztcbiAgICBjYXNlICdEZWxldGUnOlxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgY2FzZSAnQWRkJzpcbiAgICBjYXNlICdBZGRVbmlxdWUnOlxuICAgIGNhc2UgJ1JlbW92ZSc6XG4gICAgICByZXR1cm4gJ0FycmF5JztcbiAgICBjYXNlICdBZGRSZWxhdGlvbic6XG4gICAgY2FzZSAnUmVtb3ZlUmVsYXRpb24nOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogJ1JlbGF0aW9uJyxcbiAgICAgICAgdGFyZ2V0Q2xhc3M6IG9iai5vYmplY3RzWzBdLmNsYXNzTmFtZVxuICAgICAgfVxuICAgIGNhc2UgJ0JhdGNoJzpcbiAgICAgIHJldHVybiBnZXRPYmplY3RUeXBlKG9iai5vcHNbMF0pO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyAndW5leHBlY3RlZCBvcDogJyArIG9iai5fX29wO1xuICAgIH1cbiAgfVxuICByZXR1cm4gJ09iamVjdCc7XG59XG5cbmV4cG9ydCB7XG4gIGxvYWQsXG4gIGNsYXNzTmFtZUlzVmFsaWQsXG4gIGZpZWxkTmFtZUlzVmFsaWQsXG4gIGludmFsaWRDbGFzc05hbWVNZXNzYWdlLFxuICBidWlsZE1lcmdlZFNjaGVtYU9iamVjdCxcbiAgc3lzdGVtQ2xhc3NlcyxcbiAgZGVmYXVsdENvbHVtbnMsXG4gIGNvbnZlcnRTY2hlbWFUb0FkYXB0ZXJTY2hlbWEsXG4gIFZvbGF0aWxlQ2xhc3Nlc1NjaGVtYXMsXG4gIFNjaGVtYUNvbnRyb2xsZXIsXG59O1xuIl19