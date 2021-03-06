'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ParseCloudCodePublisher = undefined;

var _ParsePubSub = require('./ParsePubSub');

var _node = require('parse/node');

var _node2 = _interopRequireDefault(_node);

var _logger = require('../logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class ParseCloudCodePublisher {

  // config object of the publisher, right now it only contains the redisURL,
  // but we may extend it later.
  constructor(config = {}) {
    this.parsePublisher = _ParsePubSub.ParsePubSub.createPublisher(config);
  }

  onCloudCodeAfterSave(request) {
    this._onCloudCodeMessage(_node2.default.applicationId + 'afterSave', request);
  }

  onCloudCodeAfterDelete(request) {
    this._onCloudCodeMessage(_node2.default.applicationId + 'afterDelete', request);
  }

  // Request is the request object from cloud code functions. request.object is a ParseObject.
  _onCloudCodeMessage(type, request) {
    _logger2.default.verbose('Raw request from cloud code current : %j | original : %j', request.object, request.original);
    // We need the full JSON which includes className
    const message = {
      currentParseObject: request.object._toFullJSON()
    };
    if (request.original) {
      message.originalParseObject = request.original._toFullJSON();
    }
    this.parsePublisher.publish(type, JSON.stringify(message));
  }
}

exports.ParseCloudCodePublisher = ParseCloudCodePublisher;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9MaXZlUXVlcnkvUGFyc2VDbG91ZENvZGVQdWJsaXNoZXIuanMiXSwibmFtZXMiOlsiUGFyc2VDbG91ZENvZGVQdWJsaXNoZXIiLCJjb25zdHJ1Y3RvciIsImNvbmZpZyIsInBhcnNlUHVibGlzaGVyIiwiUGFyc2VQdWJTdWIiLCJjcmVhdGVQdWJsaXNoZXIiLCJvbkNsb3VkQ29kZUFmdGVyU2F2ZSIsInJlcXVlc3QiLCJfb25DbG91ZENvZGVNZXNzYWdlIiwiUGFyc2UiLCJhcHBsaWNhdGlvbklkIiwib25DbG91ZENvZGVBZnRlckRlbGV0ZSIsInR5cGUiLCJsb2dnZXIiLCJ2ZXJib3NlIiwib2JqZWN0Iiwib3JpZ2luYWwiLCJtZXNzYWdlIiwiY3VycmVudFBhcnNlT2JqZWN0IiwiX3RvRnVsbEpTT04iLCJvcmlnaW5hbFBhcnNlT2JqZWN0IiwicHVibGlzaCIsIkpTT04iLCJzdHJpbmdpZnkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7OztBQUNBOzs7Ozs7QUFFQSxNQUFNQSx1QkFBTixDQUE4Qjs7QUFHNUI7QUFDQTtBQUNBQyxjQUFZQyxTQUFjLEVBQTFCLEVBQThCO0FBQzVCLFNBQUtDLGNBQUwsR0FBc0JDLHlCQUFZQyxlQUFaLENBQTRCSCxNQUE1QixDQUF0QjtBQUNEOztBQUVESSx1QkFBcUJDLE9BQXJCLEVBQXlDO0FBQ3ZDLFNBQUtDLG1CQUFMLENBQXlCQyxlQUFNQyxhQUFOLEdBQXNCLFdBQS9DLEVBQTRESCxPQUE1RDtBQUNEOztBQUVESSx5QkFBdUJKLE9BQXZCLEVBQTJDO0FBQ3pDLFNBQUtDLG1CQUFMLENBQXlCQyxlQUFNQyxhQUFOLEdBQXNCLGFBQS9DLEVBQThESCxPQUE5RDtBQUNEOztBQUVEO0FBQ0FDLHNCQUFvQkksSUFBcEIsRUFBa0NMLE9BQWxDLEVBQXNEO0FBQ3BETSxxQkFBT0MsT0FBUCxDQUFlLDBEQUFmLEVBQTJFUCxRQUFRUSxNQUFuRixFQUEyRlIsUUFBUVMsUUFBbkc7QUFDQTtBQUNBLFVBQU1DLFVBQVU7QUFDZEMsMEJBQW9CWCxRQUFRUSxNQUFSLENBQWVJLFdBQWY7QUFETixLQUFoQjtBQUdBLFFBQUlaLFFBQVFTLFFBQVosRUFBc0I7QUFDcEJDLGNBQVFHLG1CQUFSLEdBQThCYixRQUFRUyxRQUFSLENBQWlCRyxXQUFqQixFQUE5QjtBQUNEO0FBQ0QsU0FBS2hCLGNBQUwsQ0FBb0JrQixPQUFwQixDQUE0QlQsSUFBNUIsRUFBa0NVLEtBQUtDLFNBQUwsQ0FBZU4sT0FBZixDQUFsQztBQUNEO0FBNUIyQjs7UUFnQzVCakIsdUIsR0FBQUEsdUIiLCJmaWxlIjoiUGFyc2VDbG91ZENvZGVQdWJsaXNoZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQYXJzZVB1YlN1YiB9IGZyb20gJy4vUGFyc2VQdWJTdWInO1xuaW1wb3J0IFBhcnNlICBmcm9tICdwYXJzZS9ub2RlJztcbmltcG9ydCBsb2dnZXIgZnJvbSAnLi4vbG9nZ2VyJztcblxuY2xhc3MgUGFyc2VDbG91ZENvZGVQdWJsaXNoZXIge1xuICBwYXJzZVB1Ymxpc2hlcjogT2JqZWN0O1xuXG4gIC8vIGNvbmZpZyBvYmplY3Qgb2YgdGhlIHB1Ymxpc2hlciwgcmlnaHQgbm93IGl0IG9ubHkgY29udGFpbnMgdGhlIHJlZGlzVVJMLFxuICAvLyBidXQgd2UgbWF5IGV4dGVuZCBpdCBsYXRlci5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBhbnkgPSB7fSkge1xuICAgIHRoaXMucGFyc2VQdWJsaXNoZXIgPSBQYXJzZVB1YlN1Yi5jcmVhdGVQdWJsaXNoZXIoY29uZmlnKTtcbiAgfVxuXG4gIG9uQ2xvdWRDb2RlQWZ0ZXJTYXZlKHJlcXVlc3Q6IGFueSk6IHZvaWQge1xuICAgIHRoaXMuX29uQ2xvdWRDb2RlTWVzc2FnZShQYXJzZS5hcHBsaWNhdGlvbklkICsgJ2FmdGVyU2F2ZScsIHJlcXVlc3QpO1xuICB9XG5cbiAgb25DbG91ZENvZGVBZnRlckRlbGV0ZShyZXF1ZXN0OiBhbnkpOiB2b2lkIHtcbiAgICB0aGlzLl9vbkNsb3VkQ29kZU1lc3NhZ2UoUGFyc2UuYXBwbGljYXRpb25JZCArICdhZnRlckRlbGV0ZScsIHJlcXVlc3QpO1xuICB9XG5cbiAgLy8gUmVxdWVzdCBpcyB0aGUgcmVxdWVzdCBvYmplY3QgZnJvbSBjbG91ZCBjb2RlIGZ1bmN0aW9ucy4gcmVxdWVzdC5vYmplY3QgaXMgYSBQYXJzZU9iamVjdC5cbiAgX29uQ2xvdWRDb2RlTWVzc2FnZSh0eXBlOiBzdHJpbmcsIHJlcXVlc3Q6IGFueSk6IHZvaWQge1xuICAgIGxvZ2dlci52ZXJib3NlKCdSYXcgcmVxdWVzdCBmcm9tIGNsb3VkIGNvZGUgY3VycmVudCA6ICVqIHwgb3JpZ2luYWwgOiAlaicsIHJlcXVlc3Qub2JqZWN0LCByZXF1ZXN0Lm9yaWdpbmFsKTtcbiAgICAvLyBXZSBuZWVkIHRoZSBmdWxsIEpTT04gd2hpY2ggaW5jbHVkZXMgY2xhc3NOYW1lXG4gICAgY29uc3QgbWVzc2FnZSA9IHtcbiAgICAgIGN1cnJlbnRQYXJzZU9iamVjdDogcmVxdWVzdC5vYmplY3QuX3RvRnVsbEpTT04oKVxuICAgIH1cbiAgICBpZiAocmVxdWVzdC5vcmlnaW5hbCkge1xuICAgICAgbWVzc2FnZS5vcmlnaW5hbFBhcnNlT2JqZWN0ID0gcmVxdWVzdC5vcmlnaW5hbC5fdG9GdWxsSlNPTigpO1xuICAgIH1cbiAgICB0aGlzLnBhcnNlUHVibGlzaGVyLnB1Ymxpc2godHlwZSwgSlNPTi5zdHJpbmdpZnkobWVzc2FnZSkpO1xuICB9XG59XG5cbmV4cG9ydCB7XG4gIFBhcnNlQ2xvdWRDb2RlUHVibGlzaGVyXG59XG4iXX0=