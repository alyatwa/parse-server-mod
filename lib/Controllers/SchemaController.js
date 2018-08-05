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
  _App: {
    "lang": { type: 'String' },
    "name": { type: 'String' }
  },
  _SpamRecords: {
    "receiverID": { type: 'String' },
    "receiver": { type: 'String' },
    "file": { type: 'File' },
    "recordId": { type: 'String' },
    "sender": { type: 'String' }
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

const systemClasses = Object.freeze(['_User', '_SpamRecords', '_App', '_PublicUser', '_Records', '_PrivateRecord', '_Installation', '_Role', '_Session', '_Product', '_PushStatus', '_JobStatus', '_JobSchedule', '_Audience']);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Db250cm9sbGVycy9TY2hlbWFDb250cm9sbGVyLmpzIl0sIm5hbWVzIjpbIlBhcnNlIiwicmVxdWlyZSIsImRlZmF1bHRDb2x1bW5zIiwiT2JqZWN0IiwiZnJlZXplIiwiX0RlZmF1bHQiLCJ0eXBlIiwiX1VzZXIiLCJfUHJpdmF0ZVJlY29yZCIsIl9QdWJsaWNVc2VyIiwiX0FwcCIsIl9TcGFtUmVjb3JkcyIsIl9SZWNvcmRzIiwiX0luc3RhbGxhdGlvbiIsIl9Sb2xlIiwidGFyZ2V0Q2xhc3MiLCJfU2Vzc2lvbiIsIl9Qcm9kdWN0IiwiX1B1c2hTdGF0dXMiLCJfSm9iU3RhdHVzIiwiX0pvYlNjaGVkdWxlIiwiX0hvb2tzIiwiX0dsb2JhbENvbmZpZyIsIl9BdWRpZW5jZSIsInJlcXVpcmVkQ29sdW1ucyIsInN5c3RlbUNsYXNzZXMiLCJ2b2xhdGlsZUNsYXNzZXMiLCJ1c2VySWRSZWdleCIsInJvbGVSZWdleCIsInB1YmxpY1JlZ2V4IiwicmVxdWlyZUF1dGhlbnRpY2F0aW9uUmVnZXgiLCJwZXJtaXNzaW9uS2V5UmVnZXgiLCJ2ZXJpZnlQZXJtaXNzaW9uS2V5Iiwia2V5IiwicmVzdWx0IiwicmVkdWNlIiwiaXNHb29kIiwicmVnRXgiLCJtYXRjaCIsIkVycm9yIiwiSU5WQUxJRF9KU09OIiwiQ0xQVmFsaWRLZXlzIiwidmFsaWRhdGVDTFAiLCJwZXJtcyIsImZpZWxkcyIsImtleXMiLCJmb3JFYWNoIiwib3BlcmF0aW9uIiwiaW5kZXhPZiIsIkFycmF5IiwiaXNBcnJheSIsInBlcm0iLCJqb2luQ2xhc3NSZWdleCIsImNsYXNzQW5kRmllbGRSZWdleCIsImNsYXNzTmFtZUlzVmFsaWQiLCJjbGFzc05hbWUiLCJ0ZXN0IiwiZmllbGROYW1lSXNWYWxpZCIsImZpZWxkTmFtZSIsImZpZWxkTmFtZUlzVmFsaWRGb3JDbGFzcyIsImludmFsaWRDbGFzc05hbWVNZXNzYWdlIiwiaW52YWxpZEpzb25FcnJvciIsInZhbGlkTm9uUmVsYXRpb25PclBvaW50ZXJUeXBlcyIsImZpZWxkVHlwZUlzSW52YWxpZCIsIklOVkFMSURfQ0xBU1NfTkFNRSIsInVuZGVmaW5lZCIsIklOQ09SUkVDVF9UWVBFIiwiY29udmVydFNjaGVtYVRvQWRhcHRlclNjaGVtYSIsInNjaGVtYSIsImluamVjdERlZmF1bHRTY2hlbWEiLCJBQ0wiLCJfcnBlcm0iLCJfd3Blcm0iLCJwYXNzd29yZCIsIl9oYXNoZWRfcGFzc3dvcmQiLCJjb252ZXJ0QWRhcHRlclNjaGVtYVRvUGFyc2VTY2hlbWEiLCJhdXRoRGF0YSIsImluZGV4ZXMiLCJsZW5ndGgiLCJjbGFzc0xldmVsUGVybWlzc2lvbnMiLCJkZWZhdWx0U2NoZW1hIiwiX0hvb2tzU2NoZW1hIiwiX0dsb2JhbENvbmZpZ1NjaGVtYSIsIl9QdXNoU3RhdHVzU2NoZW1hIiwiX0pvYlN0YXR1c1NjaGVtYSIsIl9Kb2JTY2hlZHVsZVNjaGVtYSIsIl9BdWRpZW5jZVNjaGVtYSIsIlZvbGF0aWxlQ2xhc3Nlc1NjaGVtYXMiLCJkYlR5cGVNYXRjaGVzT2JqZWN0VHlwZSIsImRiVHlwZSIsIm9iamVjdFR5cGUiLCJ0eXBlVG9TdHJpbmciLCJTY2hlbWFDb250cm9sbGVyIiwiY29uc3RydWN0b3IiLCJkYXRhYmFzZUFkYXB0ZXIiLCJzY2hlbWFDYWNoZSIsIl9kYkFkYXB0ZXIiLCJfY2FjaGUiLCJkYXRhIiwicmVsb2FkRGF0YSIsIm9wdGlvbnMiLCJjbGVhckNhY2hlIiwicHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwidGhlbiIsImNsZWFyIiwicmVsb2FkRGF0YVByb21pc2UiLCJnZXRBbGxDbGFzc2VzIiwiYWxsU2NoZW1hcyIsImVyciIsImFsbENsYXNzZXMiLCJtYXAiLCJzZXRBbGxDbGFzc2VzIiwiZ2V0T25lU2NoZW1hIiwiYWxsb3dWb2xhdGlsZUNsYXNzZXMiLCJjYWNoZWQiLCJnZXRDbGFzcyIsInNldE9uZVNjaGVtYSIsImFkZENsYXNzSWZOb3RFeGlzdHMiLCJ2YWxpZGF0aW9uRXJyb3IiLCJ2YWxpZGF0ZU5ld0NsYXNzIiwicmVqZWN0IiwiY3JlYXRlQ2xhc3MiLCJyZXMiLCJjYXRjaCIsImVycm9yIiwiY29kZSIsIkRVUExJQ0FURV9WQUxVRSIsInVwZGF0ZUNsYXNzIiwic3VibWl0dGVkRmllbGRzIiwiZGF0YWJhc2UiLCJleGlzdGluZ0ZpZWxkcyIsIm5hbWUiLCJmaWVsZCIsIl9fb3AiLCJuZXdTY2hlbWEiLCJidWlsZE1lcmdlZFNjaGVtYU9iamVjdCIsImRlZmF1bHRGaWVsZHMiLCJmdWxsTmV3U2NoZW1hIiwiYXNzaWduIiwidmFsaWRhdGVTY2hlbWFEYXRhIiwiZGVsZXRlZEZpZWxkcyIsImluc2VydGVkRmllbGRzIiwicHVzaCIsImRlbGV0ZVByb21pc2UiLCJkZWxldGVGaWVsZHMiLCJwcm9taXNlcyIsImVuZm9yY2VGaWVsZEV4aXN0cyIsImFsbCIsInNldFBlcm1pc3Npb25zIiwic2V0SW5kZXhlc1dpdGhTY2hlbWFGb3JtYXQiLCJyZWxvYWRlZFNjaGVtYSIsImVuZm9yY2VDbGFzc0V4aXN0cyIsImV4aXN0aW5nRmllbGROYW1lcyIsIklOVkFMSURfS0VZX05BTUUiLCJtZXNzYWdlIiwiZ2VvUG9pbnRzIiwiZmlsdGVyIiwic2V0Q2xhc3NMZXZlbFBlcm1pc3Npb25zIiwic3BsaXQiLCJleHBlY3RlZFR5cGUiLCJnZXRFeHBlY3RlZFR5cGUiLCJhZGRGaWVsZElmTm90RXhpc3RzIiwiZGVsZXRlRmllbGQiLCJmaWVsZE5hbWVzIiwic2NoZW1hRmllbGRzIiwiYWRhcHRlciIsImRlbGV0ZUNsYXNzIiwidmFsaWRhdGVPYmplY3QiLCJvYmplY3QiLCJxdWVyeSIsImdlb2NvdW50IiwiZXhwZWN0ZWQiLCJnZXRUeXBlIiwidGhlblZhbGlkYXRlUmVxdWlyZWRDb2x1bW5zIiwidmFsaWRhdGVSZXF1aXJlZENvbHVtbnMiLCJjb2x1bW5zIiwibWlzc2luZ0NvbHVtbnMiLCJjb2x1bW4iLCJvYmplY3RJZCIsInRlc3RCYXNlQ0xQIiwiYWNsR3JvdXAiLCJjbGFzc1Blcm1zIiwic29tZSIsImFjbCIsInZhbGlkYXRlUGVybWlzc2lvbiIsIk9CSkVDVF9OT1RfRk9VTkQiLCJwZXJtaXNzaW9uRmllbGQiLCJPUEVSQVRJT05fRk9SQklEREVOIiwiaGFzQ2xhc3MiLCJsb2FkIiwiZGJBZGFwdGVyIiwicHV0UmVxdWVzdCIsInN5c1NjaGVtYUZpZWxkIiwiX2lkIiwib2xkRmllbGQiLCJmaWVsZElzRGVsZXRlZCIsIm5ld0ZpZWxkIiwic2NoZW1hUHJvbWlzZSIsIm9iaiIsImdldE9iamVjdFR5cGUiLCJfX3R5cGUiLCJpc28iLCJsYXRpdHVkZSIsImxvbmdpdHVkZSIsImJhc2U2NCIsImNvb3JkaW5hdGVzIiwib2JqZWN0cyIsIm9wcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBa0JBOztBQUNBOzs7Ozs7OztBQWxCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFFBQVFDLFFBQVEsWUFBUixFQUFzQkQsS0FBcEM7OztBQVdBLE1BQU1FLGlCQUEyQ0MsT0FBT0MsTUFBUCxDQUFjO0FBQzdEO0FBQ0FDLFlBQVU7QUFDUixnQkFBYSxFQUFDQyxNQUFLLFFBQU4sRUFETDtBQUVSLGlCQUFhLEVBQUNBLE1BQUssTUFBTixFQUZMO0FBR1IsaUJBQWEsRUFBQ0EsTUFBSyxNQUFOLEVBSEw7QUFJUixXQUFhLEVBQUNBLE1BQUssS0FBTjtBQUpMLEdBRm1EO0FBUTdEO0FBQ0FDLFNBQU87QUFDTCxnQkFBaUIsRUFBQ0QsTUFBSyxRQUFOLEVBRFo7QUFFTCxnQkFBaUIsRUFBQ0EsTUFBSyxRQUFOLEVBRlo7QUFHTCxVQUFpQixFQUFDQSxNQUFLLFFBQU4sRUFIWjtBQUlMLGVBQWlCLEVBQUNBLE1BQUssUUFBTixFQUpaO0FBS0wsV0FBaUIsRUFBQ0EsTUFBSyxNQUFOLEVBTFo7QUFNTCxXQUFpQixFQUFDQSxNQUFLLFFBQU4sRUFOWjtBQU9MLGFBQWlCLEVBQUNBLE1BQUssUUFBTixFQVBaO0FBUUws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UDtBQUNGLFdBQUssYUFBTDtBQUNBLFdBQUssZ0JBQUw7QUFDRSxlQUFPO0FBQ0xqSSxnQkFBTSxVQUREO0FBRUxTLHVCQUFheUwsSUFBSVEsT0FBSixDQUFZLENBQVosRUFBZXpKO0FBRnZCLFNBQVA7QUFJRixXQUFLLE9BQUw7QUFDRSxlQUFPa0osY0FBY0QsSUFBSVMsR0FBSixDQUFRLENBQVIsQ0FBZCxDQUFQO0FBQ0Y7QUFDRSxjQUFNLG9CQUFvQlQsSUFBSWpFLElBQTlCO0FBbEJGO0FBb0JEO0FBQ0QsU0FBTyxRQUFQO0FBQ0Q7O1FBR0N3RCxJLEdBQUFBLEk7UUFDQXpJLGdCLEdBQUFBLGdCO1FBQ0FHLGdCLEdBQUFBLGdCO1FBQ0FHLHVCLEdBQUFBLHVCO1FBQ0E2RSx1QixHQUFBQSx1QjtRQUNBaEgsYSxHQUFBQSxhO1FBQ0F2QixjLEdBQUFBLGM7UUFDQWlFLDRCLEdBQUFBLDRCO1FBQ0FvQixzQixHQUFBQSxzQjtRQUNBSyxnQixHQUFBQSxnQiIsImZpbGUiOiJTY2hlbWFDb250cm9sbGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQGZsb3dcbi8vIFRoaXMgY2xhc3MgaGFuZGxlcyBzY2hlbWEgdmFsaWRhdGlvbiwgcGVyc2lzdGVuY2UsIGFuZCBtb2RpZmljYXRpb24uXG4vL1xuLy8gRWFjaCBpbmRpdmlkdWFsIFNjaGVtYSBvYmplY3Qgc2hvdWxkIGJlIGltbXV0YWJsZS4gVGhlIGhlbHBlcnMgdG9cbi8vIGRvIHRoaW5ncyB3aXRoIHRoZSBTY2hlbWEganVzdCByZXR1cm4gYSBuZXcgc2NoZW1hIHdoZW4gdGhlIHNjaGVtYVxuLy8gaXMgY2hhbmdlZC5cbi8vXG4vLyBUaGUgY2Fub25pY2FsIHBsYWNlIHRvIHN0b3JlIHRoaXMgU2NoZW1hIGlzIGluIHRoZSBkYXRhYmFzZSBpdHNlbGYsXG4vLyBpbiBhIF9TQ0hFTUEgY29sbGVjdGlvbi4gVGhpcyBpcyBub3QgdGhlIHJpZ2h0IHdheSB0byBkbyBpdCBmb3IgYW5cbi8vIG9wZW4gc291cmNlIGZyYW1ld29yaywgYnV0IGl0J3MgYmFja3dhcmQgY29tcGF0aWJsZSwgc28gd2UncmVcbi8vIGtlZXBpbmcgaXQgdGhpcyB3YXkgZm9yIG5vdy5cbi8vXG4vLyBJbiBBUEktaGFuZGxpbmcgY29kZSwgeW91IHNob3VsZCBvbmx5IHVzZSB0aGUgU2NoZW1hIGNsYXNzIHZpYSB0aGVcbi8vIERhdGFiYXNlQ29udHJvbGxlci4gVGhpcyB3aWxsIGxldCB1cyByZXBsYWNlIHRoZSBzY2hlbWEgbG9naWMgZm9yXG4vLyBkaWZmZXJlbnQgZGF0YWJhc2VzLlxuLy8gVE9ETzogaGlkZSBhbGwgc2NoZW1hIGxvZ2ljIGluc2lkZSB0aGUgZGF0YWJhc2UgYWRhcHRlci5cbi8vIEBmbG93LWRpc2FibGUtbmV4dFxuY29uc3QgUGFyc2UgPSByZXF1aXJlKCdwYXJzZS9ub2RlJykuUGFyc2U7XG5pbXBvcnQgeyBTdG9yYWdlQWRhcHRlciB9ICAgICBmcm9tICcuLi9BZGFwdGVycy9TdG9yYWdlL1N0b3JhZ2VBZGFwdGVyJztcbmltcG9ydCBEYXRhYmFzZUNvbnRyb2xsZXIgICAgIGZyb20gJy4vRGF0YWJhc2VDb250cm9sbGVyJztcbmltcG9ydCB0eXBlIHtcbiAgU2NoZW1hLFxuICBTY2hlbWFGaWVsZHMsXG4gIENsYXNzTGV2ZWxQZXJtaXNzaW9ucyxcbiAgU2NoZW1hRmllbGQsXG4gIExvYWRTY2hlbWFPcHRpb25zLFxufSBmcm9tICcuL3R5cGVzJztcblxuY29uc3QgZGVmYXVsdENvbHVtbnM6IHtbc3RyaW5nXTogU2NoZW1hRmllbGRzfSA9IE9iamVjdC5mcmVlemUoe1xuICAvLyBDb250YWluIHRoZSBkZWZhdWx0IGNvbHVtbnMgZm9yIGV2ZXJ5IHBhcnNlIG9iamVjdCB0eXBlIChleGNlcHQgX0pvaW4gY29sbGVjdGlvbilcbiAgX0RlZmF1bHQ6IHtcbiAgICBcIm9iamVjdElkXCI6ICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJjcmVhdGVkQXRcIjoge3R5cGU6J0RhdGUnfSxcbiAgICBcInVwZGF0ZWRBdFwiOiB7dHlwZTonRGF0ZSd9LFxuICAgIFwiQUNMXCI6ICAgICAgIHt0eXBlOidBQ0wnfSxcbiAgfSxcbiAgLy8gVGhlIGFkZGl0aW9uYWwgZGVmYXVsdCBjb2x1bW5zIGZvciB0aGUgX1VzZXIgY29sbGVjdGlvbiAoaW4gYWRkaXRpb24gdG8gRGVmYXVsdENvbHMpXG4gIF9Vc2VyOiB7XG4gICAgXCJ1c2VybmFtZVwiOiAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInBhc3N3b3JkXCI6ICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiaXBcIjogICAgICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJjb3VudHJ5XCI6ICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImltZ1wiOiAgICAgICAgICAge3R5cGU6J0ZpbGUnfSxcbiAgICBcIkZDTVwiOiAgICAgICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiZW1haWxcIjogICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJlbWFpbFZlcmlmaWVkXCI6IHt0eXBlOidCb29sZWFuJ30sXG4gICAgXCJhdXRoRGF0YVwiOiAgICAgIHt0eXBlOidPYmplY3QnfSxcbiAgICBcIm5ld1wiOiAgICAgICAgICAge3R5cGU6J051bWJlcid9LFxuICB9LFxuICBfUHJpdmF0ZVJlY29yZDoge1xuICAgIFwicmVjb3JkSWRcIjogICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJzZW5kZXJcIjogICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImZpbGVcIjogICAgICAgICAgIHt0eXBlOidGaWxlJ30sXG4gICAgXCJyZWNlaXZlcklkXCI6ICAge3R5cGU6J1N0cmluZyd9XG4gIH0sXG4gIF9QdWJsaWNVc2VyOiB7XG4gICAgXCJ1c2VybmFtZVwiOiAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInVzZXJJZFwiOiAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImltZ1wiOiAgICAgICAgICAge3R5cGU6J0ZpbGUnfVxuICB9LFxuICBfQXBwOiB7XG4gICAgXCJsYW5nXCI6ICAgICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwibmFtZVwiOiAgICAgICAgIHt0eXBlOidTdHJpbmcnfVxuICB9LFxuICBfU3BhbVJlY29yZHM6IHtcbiAgICBcInJlY2VpdmVySURcIjogICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJyZWNlaXZlclwiOiAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImZpbGVcIjogICAgICAgICAgIHt0eXBlOidGaWxlJ30sXG4gICAgXCJyZWNvcmRJZFwiOiAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInNlbmRlclwiOiAgICAgICAge3R5cGU6J1N0cmluZyd9XG4gIH0sXG4gIF9SZWNvcmRzOiB7XG4gICAgXCJyZWNlaXZlcklEXCI6ICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwicmVjZWl2ZXJcIjogICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJmaWxlXCI6ICAgICAgICAgICB7dHlwZTonRmlsZSd9XG4gIH0sXG4gIC8vIFRoZSBhZGRpdGlvbmFsIGRlZmF1bHQgY29sdW1ucyBmb3IgdGhlIF9JbnN0YWxsYXRpb24gY29sbGVjdGlvbiAoaW4gYWRkaXRpb24gdG8gRGVmYXVsdENvbHMpXG4gIF9JbnN0YWxsYXRpb246IHtcbiAgICBcImluc3RhbGxhdGlvbklkXCI6ICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiZGV2aWNlVG9rZW5cIjogICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJjaGFubmVsc1wiOiAgICAgICAgIHt0eXBlOidBcnJheSd9LFxuICAgIFwiZGV2aWNlVHlwZVwiOiAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJwdXNoVHlwZVwiOiAgICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcIkdDTVNlbmRlcklkXCI6ICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwidGltZVpvbmVcIjogICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJsb2NhbGVJZGVudGlmaWVyXCI6IHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImJhZGdlXCI6ICAgICAgICAgICAge3R5cGU6J051bWJlcid9LFxuICAgIFwiYXBwVmVyc2lvblwiOiAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJhcHBOYW1lXCI6ICAgICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImFwcElkZW50aWZpZXJcIjogICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwicGFyc2VWZXJzaW9uXCI6ICAgICB7dHlwZTonU3RyaW5nJ30sXG4gIH0sXG4gIC8vIFRoZSBhZGRpdGlvbmFsIGRlZmF1bHQgY29sdW1ucyBmb3IgdGhlIF9Sb2xlIGNvbGxlY3Rpb24gKGluIGFkZGl0aW9uIHRvIERlZmF1bHRDb2xzKVxuICBfUm9sZToge1xuICAgIFwibmFtZVwiOiAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwidXNlcnNcIjoge3R5cGU6J1JlbGF0aW9uJywgdGFyZ2V0Q2xhc3M6J19Vc2VyJ30sXG4gICAgXCJyb2xlc1wiOiB7dHlwZTonUmVsYXRpb24nLCB0YXJnZXRDbGFzczonX1JvbGUnfVxuICB9LFxuICAvLyBUaGUgYWRkaXRpb25hbCBkZWZhdWx0IGNvbHVtbnMgZm9yIHRoZSBfU2Vzc2lvbiBjb2xsZWN0aW9uIChpbiBhZGRpdGlvbiB0byBEZWZhdWx0Q29scylcbiAgX1Nlc3Npb246IHtcbiAgICBcInJlc3RyaWN0ZWRcIjogICAgIHt0eXBlOidCb29sZWFuJ30sXG4gICAgXCJ1c2VyXCI6ICAgICAgICAgICB7dHlwZTonUG9pbnRlcicsIHRhcmdldENsYXNzOidfVXNlcid9LFxuICAgIFwiaW5zdGFsbGF0aW9uSWRcIjoge3R5cGU6J1N0cmluZyd9LFxuICAgIFwic2Vzc2lvblRva2VuXCI6ICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiZXhwaXJlc0F0XCI6ICAgICAge3R5cGU6J0RhdGUnfSxcbiAgICBcImNyZWF0ZWRXaXRoXCI6ICAgIHt0eXBlOidPYmplY3QnfVxuICB9LFxuICBfUHJvZHVjdDoge1xuICAgIFwicHJvZHVjdElkZW50aWZpZXJcIjogIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImRvd25sb2FkXCI6ICAgICAgICAgICB7dHlwZTonRmlsZSd9LFxuICAgIFwiZG93bmxvYWROYW1lXCI6ICAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImljb25cIjogICAgICAgICAgICAgICB7dHlwZTonRmlsZSd9LFxuICAgIFwib3JkZXJcIjogICAgICAgICAgICAgIHt0eXBlOidOdW1iZXInfSxcbiAgICBcInRpdGxlXCI6ICAgICAgICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJzdWJ0aXRsZVwiOiAgICAgICAgICAge3R5cGU6J1N0cmluZyd9LFxuICB9LFxuICBfUHVzaFN0YXR1czoge1xuICAgIFwicHVzaFRpbWVcIjogICAgICAgICAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJzb3VyY2VcIjogICAgICAgICAgICAgIHt0eXBlOidTdHJpbmcnfSwgLy8gcmVzdCBvciB3ZWJ1aVxuICAgIFwicXVlcnlcIjogICAgICAgICAgICAgICB7dHlwZTonU3RyaW5nJ30sIC8vIHRoZSBzdHJpbmdpZmllZCBKU09OIHF1ZXJ5XG4gICAgXCJwYXlsb2FkXCI6ICAgICAgICAgICAgIHt0eXBlOidTdHJpbmcnfSwgLy8gdGhlIHN0cmluZ2lmaWVkIEpTT04gcGF5bG9hZCxcbiAgICBcInRpdGxlXCI6ICAgICAgICAgICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiZXhwaXJ5XCI6ICAgICAgICAgICAgICB7dHlwZTonTnVtYmVyJ30sXG4gICAgXCJleHBpcmF0aW9uX2ludGVydmFsXCI6IHt0eXBlOidOdW1iZXInfSxcbiAgICBcInN0YXR1c1wiOiAgICAgICAgICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwibnVtU2VudFwiOiAgICAgICAgICAgICB7dHlwZTonTnVtYmVyJ30sXG4gICAgXCJudW1GYWlsZWRcIjogICAgICAgICAgIHt0eXBlOidOdW1iZXInfSxcbiAgICBcInB1c2hIYXNoXCI6ICAgICAgICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwiZXJyb3JNZXNzYWdlXCI6ICAgICAgICB7dHlwZTonT2JqZWN0J30sXG4gICAgXCJzZW50UGVyVHlwZVwiOiAgICAgICAgIHt0eXBlOidPYmplY3QnfSxcbiAgICBcImZhaWxlZFBlclR5cGVcIjogICAgICAge3R5cGU6J09iamVjdCd9LFxuICAgIFwic2VudFBlclVUQ09mZnNldFwiOiAgICB7dHlwZTonT2JqZWN0J30sXG4gICAgXCJmYWlsZWRQZXJVVENPZmZzZXRcIjogIHt0eXBlOidPYmplY3QnfSxcbiAgICBcImNvdW50XCI6ICAgICAgICAgICAgICAge3R5cGU6J051bWJlcid9IC8vIHRyYWNrcyAjIG9mIGJhdGNoZXMgcXVldWVkIGFuZCBwZW5kaW5nXG4gIH0sXG4gIF9Kb2JTdGF0dXM6IHtcbiAgICBcImpvYk5hbWVcIjogICAge3R5cGU6ICdTdHJpbmcnfSxcbiAgICBcInNvdXJjZVwiOiAgICAge3R5cGU6ICdTdHJpbmcnfSxcbiAgICBcInN0YXR1c1wiOiAgICAge3R5cGU6ICdTdHJpbmcnfSxcbiAgICBcIm1lc3NhZ2VcIjogICAge3R5cGU6ICdTdHJpbmcnfSxcbiAgICBcInBhcmFtc1wiOiAgICAge3R5cGU6ICdPYmplY3QnfSwgLy8gcGFyYW1zIHJlY2VpdmVkIHdoZW4gY2FsbGluZyB0aGUgam9iXG4gICAgXCJmaW5pc2hlZEF0XCI6IHt0eXBlOiAnRGF0ZSd9XG4gIH0sXG4gIF9Kb2JTY2hlZHVsZToge1xuICAgIFwiam9iTmFtZVwiOiAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImRlc2NyaXB0aW9uXCI6ICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJwYXJhbXNcIjogICAgICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwic3RhcnRBZnRlclwiOiAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcImRheXNPZldlZWtcIjogICB7dHlwZTonQXJyYXknfSxcbiAgICBcInRpbWVPZkRheVwiOiAgICB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJsYXN0UnVuXCI6ICAgICAge3R5cGU6J051bWJlcid9LFxuICAgIFwicmVwZWF0TWludXRlc1wiOnt0eXBlOidOdW1iZXInfVxuICB9LFxuICBfSG9va3M6IHtcbiAgICBcImZ1bmN0aW9uTmFtZVwiOiB7dHlwZTonU3RyaW5nJ30sXG4gICAgXCJjbGFzc05hbWVcIjogICAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwidHJpZ2dlck5hbWVcIjogIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInVybFwiOiAgICAgICAgICB7dHlwZTonU3RyaW5nJ31cbiAgfSxcbiAgX0dsb2JhbENvbmZpZzoge1xuICAgIFwib2JqZWN0SWRcIjoge3R5cGU6ICdTdHJpbmcnfSxcbiAgICBcInBhcmFtc1wiOiAgIHt0eXBlOiAnT2JqZWN0J31cbiAgfSxcbiAgX0F1ZGllbmNlOiB7XG4gICAgXCJvYmplY3RJZFwiOiAge3R5cGU6J1N0cmluZyd9LFxuICAgIFwibmFtZVwiOiAgICAgIHt0eXBlOidTdHJpbmcnfSxcbiAgICBcInF1ZXJ5XCI6ICAgICB7dHlwZTonU3RyaW5nJ30sIC8vc3RvcmluZyBxdWVyeSBhcyBKU09OIHN0cmluZyB0byBwcmV2ZW50IFwiTmVzdGVkIGtleXMgc2hvdWxkIG5vdCBjb250YWluIHRoZSAnJCcgb3IgJy4nIGNoYXJhY3RlcnNcIiBlcnJvclxuICAgIFwibGFzdFVzZWRcIjogIHt0eXBlOidEYXRlJ30sXG4gICAgXCJ0aW1lc1VzZWRcIjoge3R5cGU6J051bWJlcid9XG4gIH1cbn0pO1xuXG5jb25zdCByZXF1aXJlZENvbHVtbnMgPSBPYmplY3QuZnJlZXplKHtcbiAgX1Byb2R1Y3Q6IFtcInByb2R1Y3RJZGVudGlmaWVyXCIsIFwiaWNvblwiLCBcIm9yZGVyXCIsIFwidGl0bGVcIiwgXCJzdWJ0aXRsZVwiXSxcbiAgX1JvbGU6IFtcIm5hbWVcIiwgXCJBQ0xcIl1cbn0pO1xuXG5jb25zdCBzeXN0ZW1DbGFzc2VzID0gT2JqZWN0LmZyZWV6ZShbJ19Vc2VyJywgJ19TcGFtUmVjb3JkcycsICdfQXBwJywgJ19QdWJsaWNVc2VyJywgJ19SZWNvcmRzJywgJ19Qcml2YXRlUmVjb3JkJywgJ19JbnN0YWxsYXRpb24nLCAnX1JvbGUnLCAnX1Nlc3Npb24nLCAnX1Byb2R1Y3QnLCAnX1B1c2hTdGF0dXMnLCAnX0pvYlN0YXR1cycsICdfSm9iU2NoZWR1bGUnLCAnX0F1ZGllbmNlJ10pO1xuXG5jb25zdCB2b2xhdGlsZUNsYXNzZXMgPSBPYmplY3QuZnJlZXplKFsnX0pvYlN0YXR1cycsICdfUHVzaFN0YXR1cycsICdfSG9va3MnLCAnX0dsb2JhbENvbmZpZycsICdfSm9iU2NoZWR1bGUnLCAnX0F1ZGllbmNlJ10pO1xuXG4vLyAxMCBhbHBoYSBudW1iZXJpYyBjaGFycyArIHVwcGVyY2FzZVxuY29uc3QgdXNlcklkUmVnZXggPSAvXlthLXpBLVowLTldezEwfSQvO1xuLy8gQW55dGhpbmcgdGhhdCBzdGFydCB3aXRoIHJvbGVcbmNvbnN0IHJvbGVSZWdleCA9IC9ecm9sZTouKi87XG4vLyAqIHBlcm1pc3Npb25cbmNvbnN0IHB1YmxpY1JlZ2V4ID0gL15cXCokL1xuXG5jb25zdCByZXF1aXJlQXV0aGVudGljYXRpb25SZWdleCA9IC9ecmVxdWlyZXNBdXRoZW50aWNhdGlvbiQvXG5cbmNvbnN0IHBlcm1pc3Npb25LZXlSZWdleCA9IE9iamVjdC5mcmVlemUoW3VzZXJJZFJlZ2V4LCByb2xlUmVnZXgsIHB1YmxpY1JlZ2V4LCByZXF1aXJlQXV0aGVudGljYXRpb25SZWdleF0pO1xuXG5mdW5jdGlvbiB2ZXJpZnlQZXJtaXNzaW9uS2V5KGtleSkge1xuICBjb25zdCByZXN1bHQgPSBwZXJtaXNzaW9uS2V5UmVnZXgucmVkdWNlKChpc0dvb2QsIHJlZ0V4KSA9PiB7XG4gICAgaXNHb29kID0gaXNHb29kIHx8IGtleS5tYXRjaChyZWdFeCkgIT0gbnVsbDtcbiAgICByZXR1cm4gaXNHb29kO1xuICB9LCBmYWxzZSk7XG4gIGlmICghcmVzdWx0KSB7XG4gICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgYCcke2tleX0nIGlzIG5vdCBhIHZhbGlkIGtleSBmb3IgY2xhc3MgbGV2ZWwgcGVybWlzc2lvbnNgKTtcbiAgfVxufVxuXG5jb25zdCBDTFBWYWxpZEtleXMgPSBPYmplY3QuZnJlZXplKFsnZmluZCcsICdjb3VudCcsICdnZXQnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdkZWxldGUnLCAnYWRkRmllbGQnLCAncmVhZFVzZXJGaWVsZHMnLCAnd3JpdGVVc2VyRmllbGRzJ10pO1xuZnVuY3Rpb24gdmFsaWRhdGVDTFAocGVybXM6IENsYXNzTGV2ZWxQZXJtaXNzaW9ucywgZmllbGRzOiBTY2hlbWFGaWVsZHMpIHtcbiAgaWYgKCFwZXJtcykge1xuICAgIHJldHVybjtcbiAgfVxuICBPYmplY3Qua2V5cyhwZXJtcykuZm9yRWFjaCgob3BlcmF0aW9uKSA9PiB7XG4gICAgaWYgKENMUFZhbGlkS2V5cy5pbmRleE9mKG9wZXJhdGlvbikgPT0gLTEpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sIGAke29wZXJhdGlvbn0gaXMgbm90IGEgdmFsaWQgb3BlcmF0aW9uIGZvciBjbGFzcyBsZXZlbCBwZXJtaXNzaW9uc2ApO1xuICAgIH1cbiAgICBpZiAoIXBlcm1zW29wZXJhdGlvbl0pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAob3BlcmF0aW9uID09PSAncmVhZFVzZXJGaWVsZHMnIHx8IG9wZXJhdGlvbiA9PT0gJ3dyaXRlVXNlckZpZWxkcycpIHtcbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShwZXJtc1tvcGVyYXRpb25dKSkge1xuICAgICAgICAvLyBAZmxvdy1kaXNhYmxlLW5leHRcbiAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgYCcke3Blcm1zW29wZXJhdGlvbl19JyBpcyBub3QgYSB2YWxpZCB2YWx1ZSBmb3IgY2xhc3MgbGV2ZWwgcGVybWlzc2lvbnMgJHtvcGVyYXRpb259YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZXJtc1tvcGVyYXRpb25dLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgICAgIGlmICghZmllbGRzW2tleV0gfHwgZmllbGRzW2tleV0udHlwZSAhPSAnUG9pbnRlcicgfHwgZmllbGRzW2tleV0udGFyZ2V0Q2xhc3MgIT0gJ19Vc2VyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgYCcke2tleX0nIGlzIG5vdCBhIHZhbGlkIGNvbHVtbiBmb3IgY2xhc3MgbGV2ZWwgcG9pbnRlciBwZXJtaXNzaW9ucyAke29wZXJhdGlvbn1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEBmbG93LWRpc2FibGUtbmV4dFxuICAgIE9iamVjdC5rZXlzKHBlcm1zW29wZXJhdGlvbl0pLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgdmVyaWZ5UGVybWlzc2lvbktleShrZXkpO1xuICAgICAgLy8gQGZsb3ctZGlzYWJsZS1uZXh0XG4gICAgICBjb25zdCBwZXJtID0gcGVybXNbb3BlcmF0aW9uXVtrZXldO1xuICAgICAgaWYgKHBlcm0gIT09IHRydWUpIHtcbiAgICAgICAgLy8gQGZsb3ctZGlzYWJsZS1uZXh0XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sIGAnJHtwZXJtfScgaXMgbm90IGEgdmFsaWQgdmFsdWUgZm9yIGNsYXNzIGxldmVsIHBlcm1pc3Npb25zICR7b3BlcmF0aW9ufToke2tleX06JHtwZXJtfWApO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cbmNvbnN0IGpvaW5DbGFzc1JlZ2V4ID0gL15fSm9pbjpbQS1aYS16MC05X10rOltBLVphLXowLTlfXSsvO1xuY29uc3QgY2xhc3NBbmRGaWVsZFJlZ2V4ID0gL15bQS1aYS16XVtBLVphLXowLTlfXSokLztcbmZ1bmN0aW9uIGNsYXNzTmFtZUlzVmFsaWQoY2xhc3NOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgLy8gVmFsaWQgY2xhc3NlcyBtdXN0OlxuICByZXR1cm4gKFxuICAgIC8vIEJlIG9uZSBvZiBfVXNlciwgX0luc3RhbGxhdGlvbiwgX1JvbGUsIF9TZXNzaW9uIE9SXG4gICAgc3lzdGVtQ2xhc3Nlcy5pbmRleE9mKGNsYXNzTmFtZSkgPiAtMSB8fFxuICAgIC8vIEJlIGEgam9pbiB0YWJsZSBPUlxuICAgIGpvaW5DbGFzc1JlZ2V4LnRlc3QoY2xhc3NOYW1lKSB8fFxuICAgIC8vIEluY2x1ZGUgb25seSBhbHBoYS1udW1lcmljIGFuZCB1bmRlcnNjb3JlcywgYW5kIG5vdCBzdGFydCB3aXRoIGFuIHVuZGVyc2NvcmUgb3IgbnVtYmVyXG4gICAgZmllbGROYW1lSXNWYWxpZChjbGFzc05hbWUpXG4gICk7XG59XG5cbi8vIFZhbGlkIGZpZWxkcyBtdXN0IGJlIGFscGhhLW51bWVyaWMsIGFuZCBub3Qgc3RhcnQgd2l0aCBhbiB1bmRlcnNjb3JlIG9yIG51bWJlclxuZnVuY3Rpb24gZmllbGROYW1lSXNWYWxpZChmaWVsZE5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gY2xhc3NBbmRGaWVsZFJlZ2V4LnRlc3QoZmllbGROYW1lKTtcbn1cblxuLy8gQ2hlY2tzIHRoYXQgaXQncyBub3QgdHJ5aW5nIHRvIGNsb2JiZXIgb25lIG9mIHRoZSBkZWZhdWx0IGZpZWxkcyBvZiB0aGUgY2xhc3MuXG5mdW5jdGlvbiBmaWVsZE5hbWVJc1ZhbGlkRm9yQ2xhc3MoZmllbGROYW1lOiBzdHJpbmcsIGNsYXNzTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGlmICghZmllbGROYW1lSXNWYWxpZChmaWVsZE5hbWUpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChkZWZhdWx0Q29sdW1ucy5fRGVmYXVsdFtmaWVsZE5hbWVdKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChkZWZhdWx0Q29sdW1uc1tjbGFzc05hbWVdICYmIGRlZmF1bHRDb2x1bW5zW2NsYXNzTmFtZV1bZmllbGROYW1lXSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gaW52YWxpZENsYXNzTmFtZU1lc3NhZ2UoY2xhc3NOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gJ0ludmFsaWQgY2xhc3NuYW1lOiAnICsgY2xhc3NOYW1lICsgJywgY2xhc3NuYW1lcyBjYW4gb25seSBoYXZlIGFscGhhbnVtZXJpYyBjaGFyYWN0ZXJzIGFuZCBfLCBhbmQgbXVzdCBzdGFydCB3aXRoIGFuIGFscGhhIGNoYXJhY3RlciAnO1xufVxuXG5jb25zdCBpbnZhbGlkSnNvbkVycm9yID0gbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgXCJpbnZhbGlkIEpTT05cIik7XG5jb25zdCB2YWxpZE5vblJlbGF0aW9uT3JQb2ludGVyVHlwZXMgPSBbXG4gICdOdW1iZXInLFxuICAnU3RyaW5nJyxcbiAgJ0Jvb2xlYW4nLFxuICAnRGF0ZScsXG4gICdPYmplY3QnLFxuICAnQXJyYXknLFxuICAnR2VvUG9pbnQnLFxuICAnRmlsZScsXG4gICdCeXRlcycsXG4gICdQb2x5Z29uJ1xuXTtcbi8vIFJldHVybnMgYW4gZXJyb3Igc3VpdGFibGUgZm9yIHRocm93aW5nIGlmIHRoZSB0eXBlIGlzIGludmFsaWRcbmNvbnN0IGZpZWxkVHlwZUlzSW52YWxpZCA9ICh7IHR5cGUsIHRhcmdldENsYXNzIH0pID0+IHtcbiAgaWYgKFsnUG9pbnRlcicsICdSZWxhdGlvbiddLmluZGV4T2YodHlwZSkgPj0gMCkge1xuICAgIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgIHJldHVybiBuZXcgUGFyc2UuRXJyb3IoMTM1LCBgdHlwZSAke3R5cGV9IG5lZWRzIGEgY2xhc3MgbmFtZWApO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRhcmdldENsYXNzICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIGludmFsaWRKc29uRXJyb3I7XG4gICAgfSBlbHNlIGlmICghY2xhc3NOYW1lSXNWYWxpZCh0YXJnZXRDbGFzcykpIHtcbiAgICAgIHJldHVybiBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9DTEFTU19OQU1FLCBpbnZhbGlkQ2xhc3NOYW1lTWVzc2FnZSh0YXJnZXRDbGFzcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuICBpZiAodHlwZW9mIHR5cGUgIT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGludmFsaWRKc29uRXJyb3I7XG4gIH1cbiAgaWYgKHZhbGlkTm9uUmVsYXRpb25PclBvaW50ZXJUeXBlcy5pbmRleE9mKHR5cGUpIDwgMCkge1xuICAgIHJldHVybiBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5DT1JSRUNUX1RZUEUsIGBpbnZhbGlkIGZpZWxkIHR5cGU6ICR7dHlwZX1gKTtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5jb25zdCBjb252ZXJ0U2NoZW1hVG9BZGFwdGVyU2NoZW1hID0gKHNjaGVtYTogYW55KSA9PiB7XG4gIHNjaGVtYSA9IGluamVjdERlZmF1bHRTY2hlbWEoc2NoZW1hKTtcbiAgZGVsZXRlIHNjaGVtYS5maWVsZHMuQUNMO1xuICBzY2hlbWEuZmllbGRzLl9ycGVybSA9IHsgdHlwZTogJ0FycmF5JyB9O1xuICBzY2hlbWEuZmllbGRzLl93cGVybSA9IHsgdHlwZTogJ0FycmF5JyB9O1xuXG4gIGlmIChzY2hlbWEuY2xhc3NOYW1lID09PSAnX1VzZXInKSB7XG4gICAgZGVsZXRlIHNjaGVtYS5maWVsZHMucGFzc3dvcmQ7XG4gICAgc2NoZW1hLmZpZWxkcy5faGFzaGVkX3Bhc3N3b3JkID0geyB0eXBlOiAnU3RyaW5nJyB9O1xuICB9XG5cbiAgcmV0dXJuIHNjaGVtYTtcbn1cblxuY29uc3QgY29udmVydEFkYXB0ZXJTY2hlbWFUb1BhcnNlU2NoZW1hID0gKHsuLi5zY2hlbWF9KSA9PiB7XG4gIGRlbGV0ZSBzY2hlbWEuZmllbGRzLl9ycGVybTtcbiAgZGVsZXRlIHNjaGVtYS5maWVsZHMuX3dwZXJtO1xuXG4gIHNjaGVtYS5maWVsZHMuQUNMID0geyB0eXBlOiAnQUNMJyB9O1xuXG4gIGlmIChzY2hlbWEuY2xhc3NOYW1lID09PSAnX1VzZXInKSB7XG4gICAgZGVsZXRlIHNjaGVtYS5maWVsZHMuYXV0aERhdGE7IC8vQXV0aCBkYXRhIGlzIGltcGxpY2l0XG4gICAgZGVsZXRlIHNjaGVtYS5maWVsZHMuX2hhc2hlZF9wYXNzd29yZDtcbiAgICBzY2hlbWEuZmllbGRzLnBhc3N3b3JkID0geyB0eXBlOiAnU3RyaW5nJyB9O1xuICB9XG5cbiAgaWYgKHNjaGVtYS5pbmRleGVzICYmIE9iamVjdC5rZXlzKHNjaGVtYS5pbmRleGVzKS5sZW5ndGggPT09IDApIHtcbiAgICBkZWxldGUgc2NoZW1hLmluZGV4ZXM7XG4gIH1cblxuICByZXR1cm4gc2NoZW1hO1xufVxuXG5jb25zdCBpbmplY3REZWZhdWx0U2NoZW1hID0gKHtjbGFzc05hbWUsIGZpZWxkcywgY2xhc3NMZXZlbFBlcm1pc3Npb25zLCBpbmRleGVzfTogU2NoZW1hKSA9PiB7XG4gIGNvbnN0IGRlZmF1bHRTY2hlbWE6IFNjaGVtYSA9IHtcbiAgICBjbGFzc05hbWUsXG4gICAgZmllbGRzOiB7XG4gICAgICAuLi5kZWZhdWx0Q29sdW1ucy5fRGVmYXVsdCxcbiAgICAgIC4uLihkZWZhdWx0Q29sdW1uc1tjbGFzc05hbWVdIHx8IHt9KSxcbiAgICAgIC4uLmZpZWxkcyxcbiAgICB9LFxuICAgIGNsYXNzTGV2ZWxQZXJtaXNzaW9ucyxcbiAgfTtcbiAgaWYgKGluZGV4ZXMgJiYgT2JqZWN0LmtleXMoaW5kZXhlcykubGVuZ3RoICE9PSAwKSB7XG4gICAgZGVmYXVsdFNjaGVtYS5pbmRleGVzID0gaW5kZXhlcztcbiAgfVxuICByZXR1cm4gZGVmYXVsdFNjaGVtYTtcbn07XG5cbmNvbnN0IF9Ib29rc1NjaGVtYSA9ICB7Y2xhc3NOYW1lOiBcIl9Ib29rc1wiLCBmaWVsZHM6IGRlZmF1bHRDb2x1bW5zLl9Ib29rc307XG5jb25zdCBfR2xvYmFsQ29uZmlnU2NoZW1hID0geyBjbGFzc05hbWU6IFwiX0dsb2JhbENvbmZpZ1wiLCBmaWVsZHM6IGRlZmF1bHRDb2x1bW5zLl9HbG9iYWxDb25maWcgfVxuY29uc3QgX1B1c2hTdGF0dXNTY2hlbWEgPSBjb252ZXJ0U2NoZW1hVG9BZGFwdGVyU2NoZW1hKGluamVjdERlZmF1bHRTY2hlbWEoe1xuICBjbGFzc05hbWU6IFwiX1B1c2hTdGF0dXNcIixcbiAgZmllbGRzOiB7fSxcbiAgY2xhc3NMZXZlbFBlcm1pc3Npb25zOiB7fVxufSkpO1xuY29uc3QgX0pvYlN0YXR1c1NjaGVtYSA9IGNvbnZlcnRTY2hlbWFUb0FkYXB0ZXJTY2hlbWEoaW5qZWN0RGVmYXVsdFNjaGVtYSh7XG4gIGNsYXNzTmFtZTogXCJfSm9iU3RhdHVzXCIsXG4gIGZpZWxkczoge30sXG4gIGNsYXNzTGV2ZWxQZXJtaXNzaW9uczoge31cbn0pKTtcbmNvbnN0IF9Kb2JTY2hlZHVsZVNjaGVtYSA9IGNvbnZlcnRTY2hlbWFUb0FkYXB0ZXJTY2hlbWEoaW5qZWN0RGVmYXVsdFNjaGVtYSh7XG4gIGNsYXNzTmFtZTogXCJfSm9iU2NoZWR1bGVcIixcbiAgZmllbGRzOiB7fSxcbiAgY2xhc3NMZXZlbFBlcm1pc3Npb25zOiB7fVxufSkpO1xuY29uc3QgX0F1ZGllbmNlU2NoZW1hID0gY29udmVydFNjaGVtYVRvQWRhcHRlclNjaGVtYShpbmplY3REZWZhdWx0U2NoZW1hKHtcbiAgY2xhc3NOYW1lOiBcIl9BdWRpZW5jZVwiLFxuICBmaWVsZHM6IGRlZmF1bHRDb2x1bW5zLl9BdWRpZW5jZSxcbiAgY2xhc3NMZXZlbFBlcm1pc3Npb25zOiB7fVxufSkpO1xuY29uc3QgVm9sYXRpbGVDbGFzc2VzU2NoZW1hcyA9IFtfSG9va3NTY2hlbWEsIF9Kb2JTdGF0dXNTY2hlbWEsIF9Kb2JTY2hlZHVsZVNjaGVtYSwgX1B1c2hTdGF0dXNTY2hlbWEsIF9HbG9iYWxDb25maWdTY2hlbWEsIF9BdWRpZW5jZVNjaGVtYV07XG5cbmNvbnN0IGRiVHlwZU1hdGNoZXNPYmplY3RUeXBlID0gKGRiVHlwZTogU2NoZW1hRmllbGQgfCBzdHJpbmcsIG9iamVjdFR5cGU6IFNjaGVtYUZpZWxkKSA9PiB7XG4gIGlmIChkYlR5cGUudHlwZSAhPT0gb2JqZWN0VHlwZS50eXBlKSByZXR1cm4gZmFsc2U7XG4gIGlmIChkYlR5cGUudGFyZ2V0Q2xhc3MgIT09IG9iamVjdFR5cGUudGFyZ2V0Q2xhc3MpIHJldHVybiBmYWxzZTtcbiAgaWYgKGRiVHlwZSA9PT0gb2JqZWN0VHlwZS50eXBlKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGRiVHlwZS50eXBlID09PSBvYmplY3RUeXBlLnR5cGUpIHJldHVybiB0cnVlO1xuICByZXR1cm4gZmFsc2U7XG59XG5cbmNvbnN0IHR5cGVUb1N0cmluZyA9ICh0eXBlOiBTY2hlbWFGaWVsZCB8IHN0cmluZyk6IHN0cmluZyA9PiB7XG4gIGlmICh0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdHlwZTtcbiAgfVxuICBpZiAodHlwZS50YXJnZXRDbGFzcykge1xuICAgIHJldHVybiBgJHt0eXBlLnR5cGV9PCR7dHlwZS50YXJnZXRDbGFzc30+YDtcbiAgfVxuICByZXR1cm4gYCR7dHlwZS50eXBlfWA7XG59XG5cbi8vIFN0b3JlcyB0aGUgZW50aXJlIHNjaGVtYSBvZiB0aGUgYXBwIGluIGEgd2VpcmQgaHlicmlkIGZvcm1hdCBzb21ld2hlcmUgYmV0d2VlblxuLy8gdGhlIG1vbmdvIGZvcm1hdCBhbmQgdGhlIFBhcnNlIGZvcm1hdC4gU29vbiwgdGhpcyB3aWxsIGFsbCBiZSBQYXJzZSBmb3JtYXQuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTY2hlbWFDb250cm9sbGVyIHtcbiAgX2RiQWRhcHRlcjogU3RvcmFnZUFkYXB0ZXI7XG4gIGRhdGE6IGFueTtcbiAgcGVybXM6IGFueTtcbiAgaW5kZXhlczogYW55O1xuICBfY2FjaGU6IGFueTtcbiAgcmVsb2FkRGF0YVByb21pc2U6IFByb21pc2U8YW55PjtcblxuICBjb25zdHJ1Y3RvcihkYXRhYmFzZUFkYXB0ZXI6IFN0b3JhZ2VBZGFwdGVyLCBzY2hlbWFDYWNoZTogYW55KSB7XG4gICAgdGhpcy5fZGJBZGFwdGVyID0gZGF0YWJhc2VBZGFwdGVyO1xuICAgIHRoaXMuX2NhY2hlID0gc2NoZW1hQ2FjaGU7XG4gICAgLy8gdGhpcy5kYXRhW2NsYXNzTmFtZV1bZmllbGROYW1lXSB0ZWxscyB5b3UgdGhlIHR5cGUgb2YgdGhhdCBmaWVsZCwgaW4gbW9uZ28gZm9ybWF0XG4gICAgdGhpcy5kYXRhID0ge307XG4gICAgLy8gdGhpcy5wZXJtc1tjbGFzc05hbWVdW29wZXJhdGlvbl0gdGVsbHMgeW91IHRoZSBhY2wtc3R5bGUgcGVybWlzc2lvbnNcbiAgICB0aGlzLnBlcm1zID0ge307XG4gICAgLy8gdGhpcy5pbmRleGVzW2NsYXNzTmFtZV1bb3BlcmF0aW9uXSB0ZWxscyB5b3UgdGhlIGluZGV4ZXNcbiAgICB0aGlzLmluZGV4ZXMgPSB7fTtcbiAgfVxuXG4gIHJlbG9hZERhdGEob3B0aW9uczogTG9hZFNjaGVtYU9wdGlvbnMgPSB7Y2xlYXJDYWNoZTogZmFsc2V9KTogUHJvbWlzZTxhbnk+IHtcbiAgICBsZXQgcHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuICAgIGlmIChvcHRpb25zLmNsZWFyQ2FjaGUpIHtcbiAgICAgIHByb21pc2UgPSBwcm9taXNlLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGUuY2xlYXIoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAodGhpcy5yZWxvYWREYXRhUHJvbWlzZSAmJiAhb3B0aW9ucy5jbGVhckNhY2hlKSB7XG4gICAgICByZXR1cm4gdGhpcy5yZWxvYWREYXRhUHJvbWlzZTtcbiAgICB9XG4gICAgdGhpcy5yZWxvYWREYXRhUHJvbWlzZSA9IHByb21pc2UudGhlbigoKSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5nZXRBbGxDbGFzc2VzKG9wdGlvbnMpLnRoZW4oKGFsbFNjaGVtYXMpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IHt9O1xuICAgICAgICBjb25zdCBwZXJtcyA9IHt9O1xuICAgICAgICBjb25zdCBpbmRleGVzID0ge307XG4gICAgICAgIGFsbFNjaGVtYXMuZm9yRWFjaChzY2hlbWEgPT4ge1xuICAgICAgICAgIGRhdGFbc2NoZW1hLmNsYXNzTmFtZV0gPSBpbmplY3REZWZhdWx0U2NoZW1hKHNjaGVtYSkuZmllbGRzO1xuICAgICAgICAgIHBlcm1zW3NjaGVtYS5jbGFzc05hbWVdID0gc2NoZW1hLmNsYXNzTGV2ZWxQZXJtaXNzaW9ucztcbiAgICAgICAgICBpbmRleGVzW3NjaGVtYS5jbGFzc05hbWVdID0gc2NoZW1hLmluZGV4ZXM7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEluamVjdCB0aGUgaW4tbWVtb3J5IGNsYXNzZXNcbiAgICAgICAgdm9sYXRpbGVDbGFzc2VzLmZvckVhY2goY2xhc3NOYW1lID0+IHtcbiAgICAgICAgICBjb25zdCBzY2hlbWEgPSBpbmplY3REZWZhdWx0U2NoZW1hKHsgY2xhc3NOYW1lLCBmaWVsZHM6IHt9LCBjbGFzc0xldmVsUGVybWlzc2lvbnM6IHt9IH0pO1xuICAgICAgICAgIGRhdGFbY2xhc3NOYW1lXSA9IHNjaGVtYS5maWVsZHM7XG4gICAgICAgICAgcGVybXNbY2xhc3NOYW1lXSA9IHNjaGVtYS5jbGFzc0xldmVsUGVybWlzc2lvbnM7XG4gICAgICAgICAgaW5kZXhlc1tjbGFzc05hbWVdID0gc2NoZW1hLmluZGV4ZXM7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgICAgICB0aGlzLnBlcm1zID0gcGVybXM7XG4gICAgICAgIHRoaXMuaW5kZXhlcyA9IGluZGV4ZXM7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnJlbG9hZERhdGFQcm9taXNlO1xuICAgICAgfSwgKGVycikgPT4ge1xuICAgICAgICB0aGlzLmRhdGEgPSB7fTtcbiAgICAgICAgdGhpcy5wZXJtcyA9IHt9O1xuICAgICAgICB0aGlzLmluZGV4ZXMgPSB7fTtcbiAgICAgICAgZGVsZXRlIHRoaXMucmVsb2FkRGF0YVByb21pc2U7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH0pXG4gICAgfSkudGhlbigoKSA9PiB7fSk7XG4gICAgcmV0dXJuIHRoaXMucmVsb2FkRGF0YVByb21pc2U7XG4gIH1cblxuICBnZXRBbGxDbGFzc2VzKG9wdGlvbnM6IExvYWRTY2hlbWFPcHRpb25zID0ge2NsZWFyQ2FjaGU6IGZhbHNlfSk6IFByb21pc2U8QXJyYXk8U2NoZW1hPj4ge1xuICAgIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgaWYgKG9wdGlvbnMuY2xlYXJDYWNoZSkge1xuICAgICAgcHJvbWlzZSA9IHRoaXMuX2NhY2hlLmNsZWFyKCk7XG4gICAgfVxuICAgIHJldHVybiBwcm9taXNlLnRoZW4oKCkgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlLmdldEFsbENsYXNzZXMoKVxuICAgIH0pLnRoZW4oKGFsbENsYXNzZXMpID0+IHtcbiAgICAgIGlmIChhbGxDbGFzc2VzICYmIGFsbENsYXNzZXMubGVuZ3RoICYmICFvcHRpb25zLmNsZWFyQ2FjaGUpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShhbGxDbGFzc2VzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLl9kYkFkYXB0ZXIuZ2V0QWxsQ2xhc3NlcygpXG4gICAgICAgIC50aGVuKGFsbFNjaGVtYXMgPT4gYWxsU2NoZW1hcy5tYXAoaW5qZWN0RGVmYXVsdFNjaGVtYSkpXG4gICAgICAgIC50aGVuKGFsbFNjaGVtYXMgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9jYWNoZS5zZXRBbGxDbGFzc2VzKGFsbFNjaGVtYXMpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFsbFNjaGVtYXM7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgfSk7XG4gIH1cblxuICBnZXRPbmVTY2hlbWEoY2xhc3NOYW1lOiBzdHJpbmcsIGFsbG93Vm9sYXRpbGVDbGFzc2VzOiBib29sZWFuID0gZmFsc2UsIG9wdGlvbnM6IExvYWRTY2hlbWFPcHRpb25zID0ge2NsZWFyQ2FjaGU6IGZhbHNlfSk6IFByb21pc2U8U2NoZW1hPiB7XG4gICAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICBpZiAob3B0aW9ucy5jbGVhckNhY2hlKSB7XG4gICAgICBwcm9taXNlID0gdGhpcy5fY2FjaGUuY2xlYXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIHByb21pc2UudGhlbigoKSA9PiB7XG4gICAgICBpZiAoYWxsb3dWb2xhdGlsZUNsYXNzZXMgJiYgdm9sYXRpbGVDbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKSA+IC0xKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe1xuICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICBmaWVsZHM6IHRoaXMuZGF0YVtjbGFzc05hbWVdLFxuICAgICAgICAgIGNsYXNzTGV2ZWxQZXJtaXNzaW9uczogdGhpcy5wZXJtc1tjbGFzc05hbWVdLFxuICAgICAgICAgIGluZGV4ZXM6IHRoaXMuaW5kZXhlc1tjbGFzc05hbWVdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlLmdldE9uZVNjaGVtYShjbGFzc05hbWUpLnRoZW4oKGNhY2hlZCkgPT4ge1xuICAgICAgICBpZiAoY2FjaGVkICYmICFvcHRpb25zLmNsZWFyQ2FjaGUpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGNhY2hlZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2RiQWRhcHRlci5nZXRDbGFzcyhjbGFzc05hbWUpXG4gICAgICAgICAgLnRoZW4oaW5qZWN0RGVmYXVsdFNjaGVtYSlcbiAgICAgICAgICAudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGUuc2V0T25lU2NoZW1hKGNsYXNzTmFtZSwgcmVzdWx0KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIENyZWF0ZSBhIG5ldyBjbGFzcyB0aGF0IGluY2x1ZGVzIHRoZSB0aHJlZSBkZWZhdWx0IGZpZWxkcy5cbiAgLy8gQUNMIGlzIGFuIGltcGxpY2l0IGNvbHVtbiB0aGF0IGRvZXMgbm90IGdldCBhbiBlbnRyeSBpbiB0aGVcbiAgLy8gX1NDSEVNQVMgZGF0YWJhc2UuIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGVcbiAgLy8gY3JlYXRlZCBzY2hlbWEsIGluIG1vbmdvIGZvcm1hdC5cbiAgLy8gb24gc3VjY2VzcywgYW5kIHJlamVjdHMgd2l0aCBhbiBlcnJvciBvbiBmYWlsLiBFbnN1cmUgeW91XG4gIC8vIGhhdmUgYXV0aG9yaXphdGlvbiAobWFzdGVyIGtleSwgb3IgY2xpZW50IGNsYXNzIGNyZWF0aW9uXG4gIC8vIGVuYWJsZWQpIGJlZm9yZSBjYWxsaW5nIHRoaXMgZnVuY3Rpb24uXG4gIGFkZENsYXNzSWZOb3RFeGlzdHMoY2xhc3NOYW1lOiBzdHJpbmcsIGZpZWxkczogU2NoZW1hRmllbGRzID0ge30sIGNsYXNzTGV2ZWxQZXJtaXNzaW9uczogYW55LCBpbmRleGVzOiBhbnkgPSB7fSk6IFByb21pc2U8dm9pZD4ge1xuICAgIHZhciB2YWxpZGF0aW9uRXJyb3IgPSB0aGlzLnZhbGlkYXRlTmV3Q2xhc3MoY2xhc3NOYW1lLCBmaWVsZHMsIGNsYXNzTGV2ZWxQZXJtaXNzaW9ucyk7XG4gICAgaWYgKHZhbGlkYXRpb25FcnJvcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KHZhbGlkYXRpb25FcnJvcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2RiQWRhcHRlci5jcmVhdGVDbGFzcyhjbGFzc05hbWUsIGNvbnZlcnRTY2hlbWFUb0FkYXB0ZXJTY2hlbWEoeyBmaWVsZHMsIGNsYXNzTGV2ZWxQZXJtaXNzaW9ucywgaW5kZXhlcywgY2xhc3NOYW1lIH0pKVxuICAgICAgLnRoZW4oY29udmVydEFkYXB0ZXJTY2hlbWFUb1BhcnNlU2NoZW1hKVxuICAgICAgLnRoZW4oKHJlcykgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGUuY2xlYXIoKS50aGVuKCgpID0+IHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcyk7XG4gICAgICAgIH0pO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgIGlmIChlcnJvciAmJiBlcnJvci5jb2RlID09PSBQYXJzZS5FcnJvci5EVVBMSUNBVEVfVkFMVUUpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9DTEFTU19OQU1FLCBgQ2xhc3MgJHtjbGFzc05hbWV9IGFscmVhZHkgZXhpc3RzLmApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHVwZGF0ZUNsYXNzKGNsYXNzTmFtZTogc3RyaW5nLCBzdWJtaXR0ZWRGaWVsZHM6IFNjaGVtYUZpZWxkcywgY2xhc3NMZXZlbFBlcm1pc3Npb25zOiBhbnksIGluZGV4ZXM6IGFueSwgZGF0YWJhc2U6IERhdGFiYXNlQ29udHJvbGxlcikge1xuICAgIHJldHVybiB0aGlzLmdldE9uZVNjaGVtYShjbGFzc05hbWUpXG4gICAgICAudGhlbihzY2hlbWEgPT4ge1xuICAgICAgICBjb25zdCBleGlzdGluZ0ZpZWxkcyA9IHNjaGVtYS5maWVsZHM7XG4gICAgICAgIE9iamVjdC5rZXlzKHN1Ym1pdHRlZEZpZWxkcykuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgICAgICBjb25zdCBmaWVsZCA9IHN1Ym1pdHRlZEZpZWxkc1tuYW1lXTtcbiAgICAgICAgICBpZiAoZXhpc3RpbmdGaWVsZHNbbmFtZV0gJiYgZmllbGQuX19vcCAhPT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcigyNTUsIGBGaWVsZCAke25hbWV9IGV4aXN0cywgY2Fubm90IHVwZGF0ZS5gKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFleGlzdGluZ0ZpZWxkc1tuYW1lXSAmJiBmaWVsZC5fX29wID09PSAnRGVsZXRlJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKDI1NSwgYEZpZWxkICR7bmFtZX0gZG9lcyBub3QgZXhpc3QsIGNhbm5vdCBkZWxldGUuYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBkZWxldGUgZXhpc3RpbmdGaWVsZHMuX3JwZXJtO1xuICAgICAgICBkZWxldGUgZXhpc3RpbmdGaWVsZHMuX3dwZXJtO1xuICAgICAgICBjb25zdCBuZXdTY2hlbWEgPSBidWlsZE1lcmdlZFNjaGVtYU9iamVjdChleGlzdGluZ0ZpZWxkcywgc3VibWl0dGVkRmllbGRzKTtcbiAgICAgICAgY29uc3QgZGVmYXVsdEZpZWxkcyA9IGRlZmF1bHRDb2x1bW5zW2NsYXNzTmFtZV0gfHwgZGVmYXVsdENvbHVtbnMuX0RlZmF1bHQ7XG4gICAgICAgIGNvbnN0IGZ1bGxOZXdTY2hlbWEgPSBPYmplY3QuYXNzaWduKHt9LCBuZXdTY2hlbWEsIGRlZmF1bHRGaWVsZHMpO1xuICAgICAgICBjb25zdCB2YWxpZGF0aW9uRXJyb3IgPSB0aGlzLnZhbGlkYXRlU2NoZW1hRGF0YShjbGFzc05hbWUsIG5ld1NjaGVtYSwgY2xhc3NMZXZlbFBlcm1pc3Npb25zLCBPYmplY3Qua2V5cyhleGlzdGluZ0ZpZWxkcykpO1xuICAgICAgICBpZiAodmFsaWRhdGlvbkVycm9yKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKHZhbGlkYXRpb25FcnJvci5jb2RlLCB2YWxpZGF0aW9uRXJyb3IuZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmluYWxseSB3ZSBoYXZlIGNoZWNrZWQgdG8gbWFrZSBzdXJlIHRoZSByZXF1ZXN0IGlzIHZhbGlkIGFuZCB3ZSBjYW4gc3RhcnQgZGVsZXRpbmcgZmllbGRzLlxuICAgICAgICAvLyBEbyBhbGwgZGVsZXRpb25zIGZpcnN0LCB0aGVuIGEgc2luZ2xlIHNhdmUgdG8gX1NDSEVNQSBjb2xsZWN0aW9uIHRvIGhhbmRsZSBhbGwgYWRkaXRpb25zLlxuICAgICAgICBjb25zdCBkZWxldGVkRmllbGRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBpbnNlcnRlZEZpZWxkcyA9IFtdO1xuICAgICAgICBPYmplY3Qua2V5cyhzdWJtaXR0ZWRGaWVsZHMpLmZvckVhY2goZmllbGROYW1lID0+IHtcbiAgICAgICAgICBpZiAoc3VibWl0dGVkRmllbGRzW2ZpZWxkTmFtZV0uX19vcCA9PT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgICAgIGRlbGV0ZWRGaWVsZHMucHVzaChmaWVsZE5hbWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnNlcnRlZEZpZWxkcy5wdXNoKGZpZWxkTmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBsZXQgZGVsZXRlUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICBpZiAoZGVsZXRlZEZpZWxkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgZGVsZXRlUHJvbWlzZSA9IHRoaXMuZGVsZXRlRmllbGRzKGRlbGV0ZWRGaWVsZHMsIGNsYXNzTmFtZSwgZGF0YWJhc2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWxldGVQcm9taXNlIC8vIERlbGV0ZSBFdmVyeXRoaW5nXG4gICAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5yZWxvYWREYXRhKHsgY2xlYXJDYWNoZTogdHJ1ZSB9KSkgLy8gUmVsb2FkIG91ciBTY2hlbWEsIHNvIHdlIGhhdmUgYWxsIHRoZSBuZXcgdmFsdWVzXG4gICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcHJvbWlzZXMgPSBpbnNlcnRlZEZpZWxkcy5tYXAoZmllbGROYW1lID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgdHlwZSA9IHN1Ym1pdHRlZEZpZWxkc1tmaWVsZE5hbWVdO1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5lbmZvcmNlRmllbGRFeGlzdHMoY2xhc3NOYW1lLCBmaWVsZE5hbWUsIHR5cGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5zZXRQZXJtaXNzaW9ucyhjbGFzc05hbWUsIGNsYXNzTGV2ZWxQZXJtaXNzaW9ucywgbmV3U2NoZW1hKSlcbiAgICAgICAgICAudGhlbigoKSA9PiB0aGlzLl9kYkFkYXB0ZXIuc2V0SW5kZXhlc1dpdGhTY2hlbWFGb3JtYXQoY2xhc3NOYW1lLCBpbmRleGVzLCBzY2hlbWEuaW5kZXhlcywgZnVsbE5ld1NjaGVtYSkpXG4gICAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5yZWxvYWREYXRhKHsgY2xlYXJDYWNoZTogdHJ1ZSB9KSlcbiAgICAgICAgLy9UT0RPOiBNb3ZlIHRoaXMgbG9naWMgaW50byB0aGUgZGF0YWJhc2UgYWRhcHRlclxuICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlbG9hZGVkU2NoZW1hOiBTY2hlbWEgPSB7XG4gICAgICAgICAgICAgIGNsYXNzTmFtZTogY2xhc3NOYW1lLFxuICAgICAgICAgICAgICBmaWVsZHM6IHRoaXMuZGF0YVtjbGFzc05hbWVdLFxuICAgICAgICAgICAgICBjbGFzc0xldmVsUGVybWlzc2lvbnM6IHRoaXMucGVybXNbY2xhc3NOYW1lXSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleGVzW2NsYXNzTmFtZV0gJiYgT2JqZWN0LmtleXModGhpcy5pbmRleGVzW2NsYXNzTmFtZV0pLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgICAgICByZWxvYWRlZFNjaGVtYS5pbmRleGVzID0gdGhpcy5pbmRleGVzW2NsYXNzTmFtZV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVsb2FkZWRTY2hlbWE7XG4gICAgICAgICAgfSk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9DTEFTU19OQU1FLCBgQ2xhc3MgJHtjbGFzc05hbWV9IGRvZXMgbm90IGV4aXN0LmApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9KVxuICB9XG5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyBzdWNjZXNzZnVsbHkgdG8gdGhlIG5ldyBzY2hlbWFcbiAgLy8gb2JqZWN0IG9yIGZhaWxzIHdpdGggYSByZWFzb24uXG4gIGVuZm9yY2VDbGFzc0V4aXN0cyhjbGFzc05hbWU6IHN0cmluZyk6IFByb21pc2U8U2NoZW1hQ29udHJvbGxlcj4ge1xuICAgIGlmICh0aGlzLmRhdGFbY2xhc3NOYW1lXSkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzKTtcbiAgICB9XG4gICAgLy8gV2UgZG9uJ3QgaGF2ZSB0aGlzIGNsYXNzLiBVcGRhdGUgdGhlIHNjaGVtYVxuICAgIHJldHVybiB0aGlzLmFkZENsYXNzSWZOb3RFeGlzdHMoY2xhc3NOYW1lKVxuICAgIC8vIFRoZSBzY2hlbWEgdXBkYXRlIHN1Y2NlZWRlZC4gUmVsb2FkIHRoZSBzY2hlbWFcbiAgICAgIC50aGVuKCgpID0+IHRoaXMucmVsb2FkRGF0YSh7IGNsZWFyQ2FjaGU6IHRydWUgfSkpXG4gICAgICAuY2F0Y2goKCkgPT4ge1xuICAgICAgLy8gVGhlIHNjaGVtYSB1cGRhdGUgZmFpbGVkLiBUaGlzIGNhbiBiZSBva2F5IC0gaXQgbWlnaHRcbiAgICAgIC8vIGhhdmUgZmFpbGVkIGJlY2F1c2UgdGhlcmUncyBhIHJhY2UgY29uZGl0aW9uIGFuZCBhIGRpZmZlcmVudFxuICAgICAgLy8gY2xpZW50IGlzIG1ha2luZyB0aGUgZXhhY3Qgc2FtZSBzY2hlbWEgdXBkYXRlIHRoYXQgd2Ugd2FudC5cbiAgICAgIC8vIFNvIGp1c3QgcmVsb2FkIHRoZSBzY2hlbWEuXG4gICAgICAgIHJldHVybiB0aGlzLnJlbG9hZERhdGEoeyBjbGVhckNhY2hlOiB0cnVlIH0pO1xuICAgICAgfSlcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgIC8vIEVuc3VyZSB0aGF0IHRoZSBzY2hlbWEgbm93IHZhbGlkYXRlc1xuICAgICAgICBpZiAodGhpcy5kYXRhW2NsYXNzTmFtZV0pIHtcbiAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCBgRmFpbGVkIHRvIGFkZCAke2NsYXNzTmFtZX1gKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAvLyBUaGUgc2NoZW1hIHN0aWxsIGRvZXNuJ3QgdmFsaWRhdGUuIEdpdmUgdXBcbiAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgJ3NjaGVtYSBjbGFzcyBuYW1lIGRvZXMgbm90IHJldmFsaWRhdGUnKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgdmFsaWRhdGVOZXdDbGFzcyhjbGFzc05hbWU6IHN0cmluZywgZmllbGRzOiBTY2hlbWFGaWVsZHMgPSB7fSwgY2xhc3NMZXZlbFBlcm1pc3Npb25zOiBhbnkpOiBhbnkge1xuICAgIGlmICh0aGlzLmRhdGFbY2xhc3NOYW1lXSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfQ0xBU1NfTkFNRSwgYENsYXNzICR7Y2xhc3NOYW1lfSBhbHJlYWR5IGV4aXN0cy5gKTtcbiAgICB9XG4gICAgaWYgKCFjbGFzc05hbWVJc1ZhbGlkKGNsYXNzTmFtZSkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvZGU6IFBhcnNlLkVycm9yLklOVkFMSURfQ0xBU1NfTkFNRSxcbiAgICAgICAgZXJyb3I6IGludmFsaWRDbGFzc05hbWVNZXNzYWdlKGNsYXNzTmFtZSksXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52YWxpZGF0ZVNjaGVtYURhdGEoY2xhc3NOYW1lLCBmaWVsZHMsIGNsYXNzTGV2ZWxQZXJtaXNzaW9ucywgW10pO1xuICB9XG5cbiAgdmFsaWRhdGVTY2hlbWFEYXRhKGNsYXNzTmFtZTogc3RyaW5nLCBmaWVsZHM6IFNjaGVtYUZpZWxkcywgY2xhc3NMZXZlbFBlcm1pc3Npb25zOiBDbGFzc0xldmVsUGVybWlzc2lvbnMsIGV4aXN0aW5nRmllbGROYW1lczogQXJyYXk8c3RyaW5nPikge1xuICAgIGZvciAoY29uc3QgZmllbGROYW1lIGluIGZpZWxkcykge1xuICAgICAgaWYgKGV4aXN0aW5nRmllbGROYW1lcy5pbmRleE9mKGZpZWxkTmFtZSkgPCAwKSB7XG4gICAgICAgIGlmICghZmllbGROYW1lSXNWYWxpZChmaWVsZE5hbWUpKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvZGU6IFBhcnNlLkVycm9yLklOVkFMSURfS0VZX05BTUUsXG4gICAgICAgICAgICBlcnJvcjogJ2ludmFsaWQgZmllbGQgbmFtZTogJyArIGZpZWxkTmFtZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICghZmllbGROYW1lSXNWYWxpZEZvckNsYXNzKGZpZWxkTmFtZSwgY2xhc3NOYW1lKSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb2RlOiAxMzYsXG4gICAgICAgICAgICBlcnJvcjogJ2ZpZWxkICcgKyBmaWVsZE5hbWUgKyAnIGNhbm5vdCBiZSBhZGRlZCcsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBlcnJvciA9IGZpZWxkVHlwZUlzSW52YWxpZChmaWVsZHNbZmllbGROYW1lXSk7XG4gICAgICAgIGlmIChlcnJvcikgcmV0dXJuIHsgY29kZTogZXJyb3IuY29kZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGZpZWxkTmFtZSBpbiBkZWZhdWx0Q29sdW1uc1tjbGFzc05hbWVdKSB7XG4gICAgICBmaWVsZHNbZmllbGROYW1lXSA9IGRlZmF1bHRDb2x1bW5zW2NsYXNzTmFtZV1bZmllbGROYW1lXTtcbiAgICB9XG5cbiAgICBjb25zdCBnZW9Qb2ludHMgPSBPYmplY3Qua2V5cyhmaWVsZHMpLmZpbHRlcihrZXkgPT4gZmllbGRzW2tleV0gJiYgZmllbGRzW2tleV0udHlwZSA9PT0gJ0dlb1BvaW50Jyk7XG4gICAgaWYgKGdlb1BvaW50cy5sZW5ndGggPiAxKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb2RlOiBQYXJzZS5FcnJvci5JTkNPUlJFQ1RfVFlQRSxcbiAgICAgICAgZXJyb3I6ICdjdXJyZW50bHksIG9ubHkgb25lIEdlb1BvaW50IGZpZWxkIG1heSBleGlzdCBpbiBhbiBvYmplY3QuIEFkZGluZyAnICsgZ2VvUG9pbnRzWzFdICsgJyB3aGVuICcgKyBnZW9Qb2ludHNbMF0gKyAnIGFscmVhZHkgZXhpc3RzLicsXG4gICAgICB9O1xuICAgIH1cbiAgICB2YWxpZGF0ZUNMUChjbGFzc0xldmVsUGVybWlzc2lvbnMsIGZpZWxkcyk7XG4gIH1cblxuICAvLyBTZXRzIHRoZSBDbGFzcy1sZXZlbCBwZXJtaXNzaW9ucyBmb3IgYSBnaXZlbiBjbGFzc05hbWUsIHdoaWNoIG11c3QgZXhpc3QuXG4gIHNldFBlcm1pc3Npb25zKGNsYXNzTmFtZTogc3RyaW5nLCBwZXJtczogYW55LCBuZXdTY2hlbWE6IFNjaGVtYUZpZWxkcykge1xuICAgIGlmICh0eXBlb2YgcGVybXMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuICAgIHZhbGlkYXRlQ0xQKHBlcm1zLCBuZXdTY2hlbWEpO1xuICAgIHJldHVybiB0aGlzLl9kYkFkYXB0ZXIuc2V0Q2xhc3NMZXZlbFBlcm1pc3Npb25zKGNsYXNzTmFtZSwgcGVybXMpO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyBzdWNjZXNzZnVsbHkgdG8gdGhlIG5ldyBzY2hlbWFcbiAgLy8gb2JqZWN0IGlmIHRoZSBwcm92aWRlZCBjbGFzc05hbWUtZmllbGROYW1lLXR5cGUgdHVwbGUgaXMgdmFsaWQuXG4gIC8vIFRoZSBjbGFzc05hbWUgbXVzdCBhbHJlYWR5IGJlIHZhbGlkYXRlZC5cbiAgLy8gSWYgJ2ZyZWV6ZScgaXMgdHJ1ZSwgcmVmdXNlIHRvIHVwZGF0ZSB0aGUgc2NoZW1hIGZvciB0aGlzIGZpZWxkLlxuICBlbmZvcmNlRmllbGRFeGlzdHMoY2xhc3NOYW1lOiBzdHJpbmcsIGZpZWxkTmFtZTogc3RyaW5nLCB0eXBlOiBzdHJpbmcgfCBTY2hlbWFGaWVsZCkge1xuICAgIGlmIChmaWVsZE5hbWUuaW5kZXhPZihcIi5cIikgPiAwKSB7XG4gICAgICAvLyBzdWJkb2N1bWVudCBrZXkgKHgueSkgPT4gb2sgaWYgeCBpcyBvZiB0eXBlICdvYmplY3QnXG4gICAgICBmaWVsZE5hbWUgPSBmaWVsZE5hbWUuc3BsaXQoXCIuXCIpWyAwIF07XG4gICAgICB0eXBlID0gJ09iamVjdCc7XG4gICAgfVxuICAgIGlmICghZmllbGROYW1lSXNWYWxpZChmaWVsZE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9LRVlfTkFNRSwgYEludmFsaWQgZmllbGQgbmFtZTogJHtmaWVsZE5hbWV9LmApO1xuICAgIH1cblxuICAgIC8vIElmIHNvbWVvbmUgdHJpZXMgdG8gY3JlYXRlIGEgbmV3IGZpZWxkIHdpdGggbnVsbC91bmRlZmluZWQgYXMgdGhlIHZhbHVlLCByZXR1cm47XG4gICAgaWYgKCF0eXBlKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnJlbG9hZERhdGEoKS50aGVuKCgpID0+IHtcbiAgICAgIGNvbnN0IGV4cGVjdGVkVHlwZSA9IHRoaXMuZ2V0RXhwZWN0ZWRUeXBlKGNsYXNzTmFtZSwgZmllbGROYW1lKTtcbiAgICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdHlwZSA9IHsgdHlwZSB9O1xuICAgICAgfVxuXG4gICAgICBpZiAoZXhwZWN0ZWRUeXBlKSB7XG4gICAgICAgIGlmICghZGJUeXBlTWF0Y2hlc09iamVjdFR5cGUoZXhwZWN0ZWRUeXBlLCB0eXBlKSkge1xuICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICAgIFBhcnNlLkVycm9yLklOQ09SUkVDVF9UWVBFLFxuICAgICAgICAgICAgYHNjaGVtYSBtaXNtYXRjaCBmb3IgJHtjbGFzc05hbWV9LiR7ZmllbGROYW1lfTsgZXhwZWN0ZWQgJHt0eXBlVG9TdHJpbmcoZXhwZWN0ZWRUeXBlKX0gYnV0IGdvdCAke3R5cGVUb1N0cmluZyh0eXBlKX1gXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMuX2RiQWRhcHRlci5hZGRGaWVsZElmTm90RXhpc3RzKGNsYXNzTmFtZSwgZmllbGROYW1lLCB0eXBlKS50aGVuKCgpID0+IHtcbiAgICAgICAgLy8gVGhlIHVwZGF0ZSBzdWNjZWVkZWQuIFJlbG9hZCB0aGUgc2NoZW1hXG4gICAgICAgIHJldHVybiB0aGlzLnJlbG9hZERhdGEoeyBjbGVhckNhY2hlOiB0cnVlIH0pO1xuICAgICAgfSwgKGVycm9yKSA9PiB7XG4gICAgICAgIGlmIChlcnJvci5jb2RlID09IFBhcnNlLkVycm9yLklOQ09SUkVDVF9UWVBFKSB7XG4gICAgICAgICAgLy8gTWFrZSBzdXJlIHRoYXQgd2UgdGhyb3cgZXJyb3JzIHdoZW4gaXQgaXMgYXBwcm9wcmlhdGUgdG8gZG8gc28uXG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhlIHVwZGF0ZSBmYWlsZWQuIFRoaXMgY2FuIGJlIG9rYXkgLSBpdCBtaWdodCBoYXZlIGJlZW4gYSByYWNlXG4gICAgICAgIC8vIGNvbmRpdGlvbiB3aGVyZSBhbm90aGVyIGNsaWVudCB1cGRhdGVkIHRoZSBzY2hlbWEgaW4gdGhlIHNhbWVcbiAgICAgICAgLy8gd2F5IHRoYXQgd2Ugd2FudGVkIHRvLiBTbywganVzdCByZWxvYWQgdGhlIHNjaGVtYVxuICAgICAgICByZXR1cm4gdGhpcy5yZWxvYWREYXRhKHsgY2xlYXJDYWNoZTogdHJ1ZSB9KTtcbiAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAvLyBFbnN1cmUgdGhhdCB0aGUgc2NoZW1hIG5vdyB2YWxpZGF0ZXNcbiAgICAgICAgY29uc3QgZXhwZWN0ZWRUeXBlID0gdGhpcy5nZXRFeHBlY3RlZFR5cGUoY2xhc3NOYW1lLCBmaWVsZE5hbWUpO1xuICAgICAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdHlwZSA9IHsgdHlwZSB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICghZXhwZWN0ZWRUeXBlIHx8ICFkYlR5cGVNYXRjaGVzT2JqZWN0VHlwZShleHBlY3RlZFR5cGUsIHR5cGUpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgYENvdWxkIG5vdCBhZGQgZmllbGQgJHtmaWVsZE5hbWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBjYWNoZWQgc2NoZW1hXG4gICAgICAgIHRoaXMuX2NhY2hlLmNsZWFyKCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBtYWludGFpbiBjb21wYXRpYmlsaXR5XG4gIGRlbGV0ZUZpZWxkKGZpZWxkTmFtZTogc3RyaW5nLCBjbGFzc05hbWU6IHN0cmluZywgZGF0YWJhc2U6IERhdGFiYXNlQ29udHJvbGxlcikge1xuICAgIHJldHVybiB0aGlzLmRlbGV0ZUZpZWxkcyhbZmllbGROYW1lXSwgY2xhc3NOYW1lLCBkYXRhYmFzZSk7XG4gIH1cblxuICAvLyBEZWxldGUgZmllbGRzLCBhbmQgcmVtb3ZlIHRoYXQgZGF0YSBmcm9tIGFsbCBvYmplY3RzLiBUaGlzIGlzIGludGVuZGVkXG4gIC8vIHRvIHJlbW92ZSB1bnVzZWQgZmllbGRzLCBpZiBvdGhlciB3cml0ZXJzIGFyZSB3cml0aW5nIG9iamVjdHMgdGhhdCBpbmNsdWRlXG4gIC8vIHRoaXMgZmllbGQsIHRoZSBmaWVsZCBtYXkgcmVhcHBlYXIuIFJldHVybnMgYSBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aFxuICAvLyBubyBvYmplY3Qgb24gc3VjY2Vzcywgb3IgcmVqZWN0cyB3aXRoIHsgY29kZSwgZXJyb3IgfSBvbiBmYWlsdXJlLlxuICAvLyBQYXNzaW5nIHRoZSBkYXRhYmFzZSBhbmQgcHJlZml4IGlzIG5lY2Vzc2FyeSBpbiBvcmRlciB0byBkcm9wIHJlbGF0aW9uIGNvbGxlY3Rpb25zXG4gIC8vIGFuZCByZW1vdmUgZmllbGRzIGZyb20gb2JqZWN0cy4gSWRlYWxseSB0aGUgZGF0YWJhc2Ugd291bGQgYmVsb25nIHRvXG4gIC8vIGEgZGF0YWJhc2UgYWRhcHRlciBhbmQgdGhpcyBmdW5jdGlvbiB3b3VsZCBjbG9zZSBvdmVyIGl0IG9yIGFjY2VzcyBpdCB2aWEgbWVtYmVyLlxuICBkZWxldGVGaWVsZHMoZmllbGROYW1lczogQXJyYXk8c3RyaW5nPiwgY2xhc3NOYW1lOiBzdHJpbmcsIGRhdGFiYXNlOiBEYXRhYmFzZUNvbnRyb2xsZXIpIHtcbiAgICBpZiAoIWNsYXNzTmFtZUlzVmFsaWQoY2xhc3NOYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfQ0xBU1NfTkFNRSwgaW52YWxpZENsYXNzTmFtZU1lc3NhZ2UoY2xhc3NOYW1lKSk7XG4gICAgfVxuXG4gICAgZmllbGROYW1lcy5mb3JFYWNoKGZpZWxkTmFtZSA9PiB7XG4gICAgICBpZiAoIWZpZWxkTmFtZUlzVmFsaWQoZmllbGROYW1lKSkge1xuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9LRVlfTkFNRSwgYGludmFsaWQgZmllbGQgbmFtZTogJHtmaWVsZE5hbWV9YCk7XG4gICAgICB9XG4gICAgICAvL0Rvbid0IGFsbG93IGRlbGV0aW5nIHRoZSBkZWZhdWx0IGZpZWxkcy5cbiAgICAgIGlmICghZmllbGROYW1lSXNWYWxpZEZvckNsYXNzKGZpZWxkTmFtZSwgY2xhc3NOYW1lKSkge1xuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoMTM2LCBgZmllbGQgJHtmaWVsZE5hbWV9IGNhbm5vdCBiZSBjaGFuZ2VkYCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5nZXRPbmVTY2hlbWEoY2xhc3NOYW1lLCBmYWxzZSwge2NsZWFyQ2FjaGU6IHRydWV9KVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9DTEFTU19OQU1FLCBgQ2xhc3MgJHtjbGFzc05hbWV9IGRvZXMgbm90IGV4aXN0LmApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnRoZW4oc2NoZW1hID0+IHtcbiAgICAgICAgZmllbGROYW1lcy5mb3JFYWNoKGZpZWxkTmFtZSA9PiB7XG4gICAgICAgICAgaWYgKCFzY2hlbWEuZmllbGRzW2ZpZWxkTmFtZV0pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcigyNTUsIGBGaWVsZCAke2ZpZWxkTmFtZX0gZG9lcyBub3QgZXhpc3QsIGNhbm5vdCBkZWxldGUuYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBzY2hlbWFGaWVsZHMgPSB7IC4uLnNjaGVtYS5maWVsZHMgfTtcbiAgICAgICAgcmV0dXJuIGRhdGFiYXNlLmFkYXB0ZXIuZGVsZXRlRmllbGRzKGNsYXNzTmFtZSwgc2NoZW1hLCBmaWVsZE5hbWVzKVxuICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChmaWVsZE5hbWVzLm1hcChmaWVsZE5hbWUgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBmaWVsZCA9IHNjaGVtYUZpZWxkc1tmaWVsZE5hbWVdO1xuICAgICAgICAgICAgICBpZiAoZmllbGQgJiYgZmllbGQudHlwZSA9PT0gJ1JlbGF0aW9uJykge1xuICAgICAgICAgICAgICAvL0ZvciByZWxhdGlvbnMsIGRyb3AgdGhlIF9Kb2luIHRhYmxlXG4gICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFiYXNlLmFkYXB0ZXIuZGVsZXRlQ2xhc3MoYF9Kb2luOiR7ZmllbGROYW1lfToke2NsYXNzTmFtZX1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgdGhpcy5fY2FjaGUuY2xlYXIoKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLy8gVmFsaWRhdGVzIGFuIG9iamVjdCBwcm92aWRlZCBpbiBSRVNUIGZvcm1hdC5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byB0aGUgbmV3IHNjaGVtYSBpZiB0aGlzIG9iamVjdCBpc1xuICAvLyB2YWxpZC5cbiAgdmFsaWRhdGVPYmplY3QoY2xhc3NOYW1lOiBzdHJpbmcsIG9iamVjdDogYW55LCBxdWVyeTogYW55KSB7XG4gICAgbGV0IGdlb2NvdW50ID0gMDtcbiAgICBsZXQgcHJvbWlzZSA9IHRoaXMuZW5mb3JjZUNsYXNzRXhpc3RzKGNsYXNzTmFtZSk7XG4gICAgZm9yIChjb25zdCBmaWVsZE5hbWUgaW4gb2JqZWN0KSB7XG4gICAgICBpZiAob2JqZWN0W2ZpZWxkTmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGV4cGVjdGVkID0gZ2V0VHlwZShvYmplY3RbZmllbGROYW1lXSk7XG4gICAgICBpZiAoZXhwZWN0ZWQgPT09ICdHZW9Qb2ludCcpIHtcbiAgICAgICAgZ2VvY291bnQrKztcbiAgICAgIH1cbiAgICAgIGlmIChnZW9jb3VudCA+IDEpIHtcbiAgICAgICAgLy8gTWFrZSBzdXJlIGFsbCBmaWVsZCB2YWxpZGF0aW9uIG9wZXJhdGlvbnMgcnVuIGJlZm9yZSB3ZSByZXR1cm4uXG4gICAgICAgIC8vIElmIG5vdCAtIHdlIGFyZSBjb250aW51aW5nIHRvIHJ1biBsb2dpYywgYnV0IGFscmVhZHkgcHJvdmlkZWQgcmVzcG9uc2UgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICByZXR1cm4gcHJvbWlzZS50aGVuKCgpID0+IHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOQ09SUkVDVF9UWVBFLFxuICAgICAgICAgICAgJ3RoZXJlIGNhbiBvbmx5IGJlIG9uZSBnZW9wb2ludCBmaWVsZCBpbiBhIGNsYXNzJykpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmICghZXhwZWN0ZWQpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoZmllbGROYW1lID09PSAnQUNMJykge1xuICAgICAgICAvLyBFdmVyeSBvYmplY3QgaGFzIEFDTCBpbXBsaWNpdGx5LlxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbihzY2hlbWEgPT4gc2NoZW1hLmVuZm9yY2VGaWVsZEV4aXN0cyhjbGFzc05hbWUsIGZpZWxkTmFtZSwgZXhwZWN0ZWQpKTtcbiAgICB9XG4gICAgcHJvbWlzZSA9IHRoZW5WYWxpZGF0ZVJlcXVpcmVkQ29sdW1ucyhwcm9taXNlLCBjbGFzc05hbWUsIG9iamVjdCwgcXVlcnkpO1xuICAgIHJldHVybiBwcm9taXNlO1xuICB9XG5cbiAgLy8gVmFsaWRhdGVzIHRoYXQgYWxsIHRoZSBwcm9wZXJ0aWVzIGFyZSBzZXQgZm9yIHRoZSBvYmplY3RcbiAgdmFsaWRhdGVSZXF1aXJlZENvbHVtbnMoY2xhc3NOYW1lOiBzdHJpbmcsIG9iamVjdDogYW55LCBxdWVyeTogYW55KSB7XG4gICAgY29uc3QgY29sdW1ucyA9IHJlcXVpcmVkQ29sdW1uc1tjbGFzc05hbWVdO1xuICAgIGlmICghY29sdW1ucyB8fCBjb2x1bW5zLmxlbmd0aCA9PSAwKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMpO1xuICAgIH1cblxuICAgIGNvbnN0IG1pc3NpbmdDb2x1bW5zID0gY29sdW1ucy5maWx0ZXIoZnVuY3Rpb24oY29sdW1uKXtcbiAgICAgIGlmIChxdWVyeSAmJiBxdWVyeS5vYmplY3RJZCkge1xuICAgICAgICBpZiAob2JqZWN0W2NvbHVtbl0gJiYgdHlwZW9mIG9iamVjdFtjb2x1bW5dID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgLy8gVHJ5aW5nIHRvIGRlbGV0ZSBhIHJlcXVpcmVkIGNvbHVtblxuICAgICAgICAgIHJldHVybiBvYmplY3RbY29sdW1uXS5fX29wID09ICdEZWxldGUnO1xuICAgICAgICB9XG4gICAgICAgIC8vIE5vdCB0cnlpbmcgdG8gZG8gYW55dGhpbmcgdGhlcmVcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuICFvYmplY3RbY29sdW1uXVxuICAgIH0pO1xuXG4gICAgaWYgKG1pc3NpbmdDb2x1bW5zLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgUGFyc2UuRXJyb3IuSU5DT1JSRUNUX1RZUEUsXG4gICAgICAgIG1pc3NpbmdDb2x1bW5zWzBdICsgJyBpcyByZXF1aXJlZC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzKTtcbiAgfVxuXG4gIC8vIFZhbGlkYXRlcyB0aGUgYmFzZSBDTFAgZm9yIGFuIG9wZXJhdGlvblxuICB0ZXN0QmFzZUNMUChjbGFzc05hbWU6IHN0cmluZywgYWNsR3JvdXA6IHN0cmluZ1tdLCBvcGVyYXRpb246IHN0cmluZykge1xuICAgIGlmICghdGhpcy5wZXJtc1tjbGFzc05hbWVdIHx8ICF0aGlzLnBlcm1zW2NsYXNzTmFtZV1bb3BlcmF0aW9uXSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGNvbnN0IGNsYXNzUGVybXMgPSB0aGlzLnBlcm1zW2NsYXNzTmFtZV07XG4gICAgY29uc3QgcGVybXMgPSBjbGFzc1Blcm1zW29wZXJhdGlvbl07XG4gICAgLy8gSGFuZGxlIHRoZSBwdWJsaWMgc2NlbmFyaW8gcXVpY2tseVxuICAgIGlmIChwZXJtc1snKiddKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgLy8gQ2hlY2sgcGVybWlzc2lvbnMgYWdhaW5zdCB0aGUgYWNsR3JvdXAgcHJvdmlkZWQgKGFycmF5IG9mIHVzZXJJZC9yb2xlcylcbiAgICBpZiAoYWNsR3JvdXAuc29tZShhY2wgPT4geyByZXR1cm4gcGVybXNbYWNsXSA9PT0gdHJ1ZSB9KSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIFZhbGlkYXRlcyBhbiBvcGVyYXRpb24gcGFzc2VzIGNsYXNzLWxldmVsLXBlcm1pc3Npb25zIHNldCBpbiB0aGUgc2NoZW1hXG4gIHZhbGlkYXRlUGVybWlzc2lvbihjbGFzc05hbWU6IHN0cmluZywgYWNsR3JvdXA6IHN0cmluZ1tdLCBvcGVyYXRpb246IHN0cmluZykge1xuXG4gICAgaWYgKHRoaXMudGVzdEJhc2VDTFAoY2xhc3NOYW1lLCBhY2xHcm91cCwgb3BlcmF0aW9uKSkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5wZXJtc1tjbGFzc05hbWVdIHx8ICF0aGlzLnBlcm1zW2NsYXNzTmFtZV1bb3BlcmF0aW9uXSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGNvbnN0IGNsYXNzUGVybXMgPSB0aGlzLnBlcm1zW2NsYXNzTmFtZV07XG4gICAgY29uc3QgcGVybXMgPSBjbGFzc1Blcm1zW29wZXJhdGlvbl07XG5cbiAgICAvLyBJZiBvbmx5IGZvciBhdXRoZW50aWNhdGVkIHVzZXJzXG4gICAgLy8gbWFrZSBzdXJlIHdlIGhhdmUgYW4gYWNsR3JvdXBcbiAgICBpZiAocGVybXNbJ3JlcXVpcmVzQXV0aGVudGljYXRpb24nXSkge1xuICAgICAgLy8gSWYgYWNsR3JvdXAgaGFzICogKHB1YmxpYylcbiAgICAgIGlmICghYWNsR3JvdXAgfHwgYWNsR3JvdXAubGVuZ3RoID09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsXG4gICAgICAgICAgJ1Blcm1pc3Npb24gZGVuaWVkLCB1c2VyIG5lZWRzIHRvIGJlIGF1dGhlbnRpY2F0ZWQuJyk7XG4gICAgICB9IGVsc2UgaWYgKGFjbEdyb3VwLmluZGV4T2YoJyonKSA+IC0xICYmIGFjbEdyb3VwLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELFxuICAgICAgICAgICdQZXJtaXNzaW9uIGRlbmllZCwgdXNlciBuZWVkcyB0byBiZSBhdXRoZW50aWNhdGVkLicpO1xuICAgICAgfVxuICAgICAgLy8gcmVxdWlyZXNBdXRoZW50aWNhdGlvbiBwYXNzZWQsIGp1c3QgbW92ZSBmb3J3YXJkXG4gICAgICAvLyBwcm9iYWJseSB3b3VsZCBiZSB3aXNlIGF0IHNvbWUgcG9pbnQgdG8gcmVuYW1lIHRvICdhdXRoZW50aWNhdGVkVXNlcidcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICAvLyBObyBtYXRjaGluZyBDTFAsIGxldCdzIGNoZWNrIHRoZSBQb2ludGVyIHBlcm1pc3Npb25zXG4gICAgLy8gQW5kIGhhbmRsZSB0aG9zZSBsYXRlclxuICAgIGNvbnN0IHBlcm1pc3Npb25GaWVsZCA9IFsnZ2V0JywgJ2ZpbmQnLCAnY291bnQnXS5pbmRleE9mKG9wZXJhdGlvbikgPiAtMSA/ICdyZWFkVXNlckZpZWxkcycgOiAnd3JpdGVVc2VyRmllbGRzJztcblxuICAgIC8vIFJlamVjdCBjcmVhdGUgd2hlbiB3cml0ZSBsb2NrZG93blxuICAgIGlmIChwZXJtaXNzaW9uRmllbGQgPT0gJ3dyaXRlVXNlckZpZWxkcycgJiYgb3BlcmF0aW9uID09ICdjcmVhdGUnKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuT1BFUkFUSU9OX0ZPUkJJRERFTixcbiAgICAgICAgYFBlcm1pc3Npb24gZGVuaWVkIGZvciBhY3Rpb24gJHtvcGVyYXRpb259IG9uIGNsYXNzICR7Y2xhc3NOYW1lfS5gKTtcbiAgICB9XG5cbiAgICAvLyBQcm9jZXNzIHRoZSByZWFkVXNlckZpZWxkcyBsYXRlclxuICAgIGlmIChBcnJheS5pc0FycmF5KGNsYXNzUGVybXNbcGVybWlzc2lvbkZpZWxkXSkgJiYgY2xhc3NQZXJtc1twZXJtaXNzaW9uRmllbGRdLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9QRVJBVElPTl9GT1JCSURERU4sXG4gICAgICBgUGVybWlzc2lvbiBkZW5pZWQgZm9yIGFjdGlvbiAke29wZXJhdGlvbn0gb24gY2xhc3MgJHtjbGFzc05hbWV9LmApO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0aGUgZXhwZWN0ZWQgdHlwZSBmb3IgYSBjbGFzc05hbWUra2V5IGNvbWJpbmF0aW9uXG4gIC8vIG9yIHVuZGVmaW5lZCBpZiB0aGUgc2NoZW1hIGlzIG5vdCBzZXRcbiAgZ2V0RXhwZWN0ZWRUeXBlKGNsYXNzTmFtZTogc3RyaW5nLCBmaWVsZE5hbWU6IHN0cmluZyk6ID8oU2NoZW1hRmllbGQgfCBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5kYXRhICYmIHRoaXMuZGF0YVtjbGFzc05hbWVdKSB7XG4gICAgICBjb25zdCBleHBlY3RlZFR5cGUgPSB0aGlzLmRhdGFbY2xhc3NOYW1lXVtmaWVsZE5hbWVdXG4gICAgICByZXR1cm4gZXhwZWN0ZWRUeXBlID09PSAnbWFwJyA/ICdPYmplY3QnIDogZXhwZWN0ZWRUeXBlO1xuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgLy8gQ2hlY2tzIGlmIGEgZ2l2ZW4gY2xhc3MgaXMgaW4gdGhlIHNjaGVtYS5cbiAgaGFzQ2xhc3MoY2xhc3NOYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5yZWxvYWREYXRhKCkudGhlbigoKSA9PiAhISh0aGlzLmRhdGFbY2xhc3NOYW1lXSkpO1xuICB9XG59XG5cbi8vIFJldHVybnMgYSBwcm9taXNlIGZvciBhIG5ldyBTY2hlbWEuXG5jb25zdCBsb2FkID0gKGRiQWRhcHRlcjogU3RvcmFnZUFkYXB0ZXIsIHNjaGVtYUNhY2hlOiBhbnksIG9wdGlvbnM6IGFueSk6IFByb21pc2U8U2NoZW1hQ29udHJvbGxlcj4gPT4ge1xuICBjb25zdCBzY2hlbWEgPSBuZXcgU2NoZW1hQ29udHJvbGxlcihkYkFkYXB0ZXIsIHNjaGVtYUNhY2hlKTtcbiAgcmV0dXJuIHNjaGVtYS5yZWxvYWREYXRhKG9wdGlvbnMpLnRoZW4oKCkgPT4gc2NoZW1hKTtcbn1cblxuLy8gQnVpbGRzIGEgbmV3IHNjaGVtYSAoaW4gc2NoZW1hIEFQSSByZXNwb25zZSBmb3JtYXQpIG91dCBvZiBhblxuLy8gZXhpc3RpbmcgbW9uZ28gc2NoZW1hICsgYSBzY2hlbWFzIEFQSSBwdXQgcmVxdWVzdC4gVGhpcyByZXNwb25zZVxuLy8gZG9lcyBub3QgaW5jbHVkZSB0aGUgZGVmYXVsdCBmaWVsZHMsIGFzIGl0IGlzIGludGVuZGVkIHRvIGJlIHBhc3NlZFxuLy8gdG8gbW9uZ29TY2hlbWFGcm9tRmllbGRzQW5kQ2xhc3NOYW1lLiBObyB2YWxpZGF0aW9uIGlzIGRvbmUgaGVyZSwgaXRcbi8vIGlzIGRvbmUgaW4gbW9uZ29TY2hlbWFGcm9tRmllbGRzQW5kQ2xhc3NOYW1lLlxuZnVuY3Rpb24gYnVpbGRNZXJnZWRTY2hlbWFPYmplY3QoZXhpc3RpbmdGaWVsZHM6IFNjaGVtYUZpZWxkcywgcHV0UmVxdWVzdDogYW55KTogU2NoZW1hRmllbGRzIHtcbiAgY29uc3QgbmV3U2NoZW1hID0ge307XG4gIC8vIEBmbG93LWRpc2FibGUtbmV4dFxuICBjb25zdCBzeXNTY2hlbWFGaWVsZCA9IE9iamVjdC5rZXlzKGRlZmF1bHRDb2x1bW5zKS5pbmRleE9mKGV4aXN0aW5nRmllbGRzLl9pZCkgPT09IC0xID8gW10gOiBPYmplY3Qua2V5cyhkZWZhdWx0Q29sdW1uc1tleGlzdGluZ0ZpZWxkcy5faWRdKTtcbiAgZm9yIChjb25zdCBvbGRGaWVsZCBpbiBleGlzdGluZ0ZpZWxkcykge1xuICAgIGlmIChvbGRGaWVsZCAhPT0gJ19pZCcgJiYgb2xkRmllbGQgIT09ICdBQ0wnICYmICBvbGRGaWVsZCAhPT0gJ3VwZGF0ZWRBdCcgJiYgb2xkRmllbGQgIT09ICdjcmVhdGVkQXQnICYmIG9sZEZpZWxkICE9PSAnb2JqZWN0SWQnKSB7XG4gICAgICBpZiAoc3lzU2NoZW1hRmllbGQubGVuZ3RoID4gMCAmJiBzeXNTY2hlbWFGaWVsZC5pbmRleE9mKG9sZEZpZWxkKSAhPT0gLTEpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCBmaWVsZElzRGVsZXRlZCA9IHB1dFJlcXVlc3Rbb2xkRmllbGRdICYmIHB1dFJlcXVlc3Rbb2xkRmllbGRdLl9fb3AgPT09ICdEZWxldGUnXG4gICAgICBpZiAoIWZpZWxkSXNEZWxldGVkKSB7XG4gICAgICAgIG5ld1NjaGVtYVtvbGRGaWVsZF0gPSBleGlzdGluZ0ZpZWxkc1tvbGRGaWVsZF07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgbmV3RmllbGQgaW4gcHV0UmVxdWVzdCkge1xuICAgIGlmIChuZXdGaWVsZCAhPT0gJ29iamVjdElkJyAmJiBwdXRSZXF1ZXN0W25ld0ZpZWxkXS5fX29wICE9PSAnRGVsZXRlJykge1xuICAgICAgaWYgKHN5c1NjaGVtYUZpZWxkLmxlbmd0aCA+IDAgJiYgc3lzU2NoZW1hRmllbGQuaW5kZXhPZihuZXdGaWVsZCkgIT09IC0xKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgbmV3U2NoZW1hW25ld0ZpZWxkXSA9IHB1dFJlcXVlc3RbbmV3RmllbGRdO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbmV3U2NoZW1hO1xufVxuXG4vLyBHaXZlbiBhIHNjaGVtYSBwcm9taXNlLCBjb25zdHJ1Y3QgYW5vdGhlciBzY2hlbWEgcHJvbWlzZSB0aGF0XG4vLyB2YWxpZGF0ZXMgdGhpcyBmaWVsZCBvbmNlIHRoZSBzY2hlbWEgbG9hZHMuXG5mdW5jdGlvbiB0aGVuVmFsaWRhdGVSZXF1aXJlZENvbHVtbnMoc2NoZW1hUHJvbWlzZSwgY2xhc3NOYW1lLCBvYmplY3QsIHF1ZXJ5KSB7XG4gIHJldHVybiBzY2hlbWFQcm9taXNlLnRoZW4oKHNjaGVtYSkgPT4ge1xuICAgIHJldHVybiBzY2hlbWEudmFsaWRhdGVSZXF1aXJlZENvbHVtbnMoY2xhc3NOYW1lLCBvYmplY3QsIHF1ZXJ5KTtcbiAgfSk7XG59XG5cbi8vIEdldHMgdGhlIHR5cGUgZnJvbSBhIFJFU1QgQVBJIGZvcm1hdHRlZCBvYmplY3QsIHdoZXJlICd0eXBlJyBpc1xuLy8gZXh0ZW5kZWQgcGFzdCBqYXZhc2NyaXB0IHR5cGVzIHRvIGluY2x1ZGUgdGhlIHJlc3Qgb2YgdGhlIFBhcnNlXG4vLyB0eXBlIHN5c3RlbS5cbi8vIFRoZSBvdXRwdXQgc2hvdWxkIGJlIGEgdmFsaWQgc2NoZW1hIHZhbHVlLlxuLy8gVE9ETzogZW5zdXJlIHRoYXQgdGhpcyBpcyBjb21wYXRpYmxlIHdpdGggdGhlIGZvcm1hdCB1c2VkIGluIE9wZW4gREJcbmZ1bmN0aW9uIGdldFR5cGUob2JqOiBhbnkpOiA/KFNjaGVtYUZpZWxkIHwgc3RyaW5nKSB7XG4gIGNvbnN0IHR5cGUgPSB0eXBlb2Ygb2JqO1xuICBzd2l0Y2godHlwZSkge1xuICBjYXNlICdib29sZWFuJzpcbiAgICByZXR1cm4gJ0Jvb2xlYW4nO1xuICBjYXNlICdzdHJpbmcnOlxuICAgIHJldHVybiAnU3RyaW5nJztcbiAgY2FzZSAnbnVtYmVyJzpcbiAgICByZXR1cm4gJ051bWJlcic7XG4gIGNhc2UgJ21hcCc6XG4gIGNhc2UgJ29iamVjdCc6XG4gICAgaWYgKCFvYmopIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBnZXRPYmplY3RUeXBlKG9iaik7XG4gIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgY2FzZSAnc3ltYm9sJzpcbiAgY2FzZSAndW5kZWZpbmVkJzpcbiAgZGVmYXVsdDpcbiAgICB0aHJvdyAnYmFkIG9iajogJyArIG9iajtcbiAgfVxufVxuXG4vLyBUaGlzIGdldHMgdGhlIHR5cGUgZm9yIG5vbi1KU09OIHR5cGVzIGxpa2UgcG9pbnRlcnMgYW5kIGZpbGVzLCBidXRcbi8vIGFsc28gZ2V0cyB0aGUgYXBwcm9wcmlhdGUgdHlwZSBmb3IgJCBvcGVyYXRvcnMuXG4vLyBSZXR1cm5zIG51bGwgaWYgdGhlIHR5cGUgaXMgdW5rbm93bi5cbmZ1bmN0aW9uIGdldE9iamVjdFR5cGUob2JqKTogPyhTY2hlbWFGaWVsZCB8IHN0cmluZykge1xuICBpZiAob2JqIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICByZXR1cm4gJ0FycmF5JztcbiAgfVxuICBpZiAob2JqLl9fdHlwZSl7XG4gICAgc3dpdGNoKG9iai5fX3R5cGUpIHtcbiAgICBjYXNlICdQb2ludGVyJyA6XG4gICAgICBpZihvYmouY2xhc3NOYW1lKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogJ1BvaW50ZXInLFxuICAgICAgICAgIHRhcmdldENsYXNzOiBvYmouY2xhc3NOYW1lXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ1JlbGF0aW9uJyA6XG4gICAgICBpZihvYmouY2xhc3NOYW1lKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogJ1JlbGF0aW9uJyxcbiAgICAgICAgICB0YXJnZXRDbGFzczogb2JqLmNsYXNzTmFtZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdGaWxlJyA6XG4gICAgICBpZihvYmoubmFtZSkge1xuICAgICAgICByZXR1cm4gJ0ZpbGUnO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnRGF0ZScgOlxuICAgICAgaWYob2JqLmlzbykge1xuICAgICAgICByZXR1cm4gJ0RhdGUnO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnR2VvUG9pbnQnIDpcbiAgICAgIGlmKG9iai5sYXRpdHVkZSAhPSBudWxsICYmIG9iai5sb25naXR1ZGUgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gJ0dlb1BvaW50JztcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0J5dGVzJyA6XG4gICAgICBpZihvYmouYmFzZTY0KSB7XG4gICAgICAgIHJldHVybiAnQnl0ZXMnO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnUG9seWdvbicgOlxuICAgICAgaWYob2JqLmNvb3JkaW5hdGVzKSB7XG4gICAgICAgIHJldHVybiAnUG9seWdvbic7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOQ09SUkVDVF9UWVBFLCBcIlRoaXMgaXMgbm90IGEgdmFsaWQgXCIgKyBvYmouX190eXBlKTtcbiAgfVxuICBpZiAob2JqWyckbmUnXSkge1xuICAgIHJldHVybiBnZXRPYmplY3RUeXBlKG9ialsnJG5lJ10pO1xuICB9XG4gIGlmIChvYmouX19vcCkge1xuICAgIHN3aXRjaChvYmouX19vcCkge1xuICAgIGNhc2UgJ0luY3JlbWVudCc6XG4gICAgICByZXR1cm4gJ051bWJlcic7XG4gICAgY2FzZSAnRGVsZXRlJzpcbiAgICAgIHJldHVybiBudWxsO1xuICAgIGNhc2UgJ0FkZCc6XG4gICAgY2FzZSAnQWRkVW5pcXVlJzpcbiAgICBjYXNlICdSZW1vdmUnOlxuICAgICAgcmV0dXJuICdBcnJheSc7XG4gICAgY2FzZSAnQWRkUmVsYXRpb24nOlxuICAgIGNhc2UgJ1JlbW92ZVJlbGF0aW9uJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGU6ICdSZWxhdGlvbicsXG4gICAgICAgIHRhcmdldENsYXNzOiBvYmoub2JqZWN0c1swXS5jbGFzc05hbWVcbiAgICAgIH1cbiAgICBjYXNlICdCYXRjaCc6XG4gICAgICByZXR1cm4gZ2V0T2JqZWN0VHlwZShvYmoub3BzWzBdKTtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgJ3VuZXhwZWN0ZWQgb3A6ICcgKyBvYmouX19vcDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuICdPYmplY3QnO1xufVxuXG5leHBvcnQge1xuICBsb2FkLFxuICBjbGFzc05hbWVJc1ZhbGlkLFxuICBmaWVsZE5hbWVJc1ZhbGlkLFxuICBpbnZhbGlkQ2xhc3NOYW1lTWVzc2FnZSxcbiAgYnVpbGRNZXJnZWRTY2hlbWFPYmplY3QsXG4gIHN5c3RlbUNsYXNzZXMsXG4gIGRlZmF1bHRDb2x1bW5zLFxuICBjb252ZXJ0U2NoZW1hVG9BZGFwdGVyU2NoZW1hLFxuICBWb2xhdGlsZUNsYXNzZXNTY2hlbWFzLFxuICBTY2hlbWFDb250cm9sbGVyLFxufTtcbiJdfQ==