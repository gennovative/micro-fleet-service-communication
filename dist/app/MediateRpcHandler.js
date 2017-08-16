"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const back_lib_common_util_1 = require("back-lib-common-util");
const Types_1 = require("./Types");
const rpc = require("./RpcCommon");
let MessageBrokerRpcHandler = class MessageBrokerRpcHandler extends rpc.RpcHandlerBase {
    constructor(depContainer, _msgBrokerConn) {
        super(depContainer);
        this._msgBrokerConn = _msgBrokerConn;
        back_lib_common_util_1.Guard.assertArgDefined('_msgBrokerConn', _msgBrokerConn);
    }
    /**
     * @see IRpcHandler.init
     */
    init(params) {
        this._msgBrokerConn && this._msgBrokerConn.onError(err => this.emitError(err));
    }
    /**
     * @see IRpcHandler.handle
     */
    handle(action, dependencyIdentifier, actionFactory) {
        back_lib_common_util_1.Guard.assertArgDefined('action', action);
        back_lib_common_util_1.Guard.assertArgDefined('dependencyIdentifier', dependencyIdentifier);
        back_lib_common_util_1.Guard.assertIsDefined(this._name, '`name` property is required.');
        this._msgBrokerConn.subscribe(`request.${this._name}.${action}`, this.buildHandleFunc.apply(this, arguments));
    }
    buildHandleFunc(action, dependencyIdentifier, actionFactory) {
        return (msg) => {
            let request = msg.data, replyTo = msg.properties.replyTo, correlationId = msg.properties.correlationId;
            (new Promise((resolve, reject) => {
                let actionFn = this.resolveActionFunc(action, dependencyIdentifier, actionFactory);
                // Execute controller's action
                actionFn(request.payload, resolve, reject, request);
            }))
                .then(result => {
                // Sends response to reply topic
                return this._msgBrokerConn.publish(replyTo, this.createResponse(true, result, request.from), { correlationId });
            })
                .catch(error => {
                let errMsg = error;
                // If error is an uncaught Exception/Error object, that means the action method
                // has a problem. We should nack to tell message broker to send this message to someone else.
                if (error instanceof Error) {
                    // Clone to a plain object, as class Error has problem
                    // with JSON.stringify.
                    errMsg = {
                        message: error.message
                    };
                }
                else if (error instanceof back_lib_common_util_1.Exception) {
                    // TODO: Should log this unexpected error.
                    delete error.stack;
                    // nack(); // Disable this, because we use auto-ack.
                }
                // If this is a custom error, which means the action method sends this error
                // back to caller on purpose.
                return this._msgBrokerConn.publish(replyTo, this.createResponse(false, errMsg, request.from), { correlationId });
            });
        };
    }
};
MessageBrokerRpcHandler = __decorate([
    back_lib_common_util_1.injectable(),
    __param(0, back_lib_common_util_1.inject(back_lib_common_util_1.Types.DEPENDENCY_CONTAINER)),
    __param(1, back_lib_common_util_1.inject(Types_1.Types.MSG_BROKER_CONNECTOR)),
    __metadata("design:paramtypes", [Object, Object])
], MessageBrokerRpcHandler);
exports.MessageBrokerRpcHandler = MessageBrokerRpcHandler;

//# sourceMappingURL=MediateRpcHandler.js.map
