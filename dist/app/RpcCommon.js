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
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const back_lib_common_util_1 = require("back-lib-common-util");
const back_lib_common_contracts_1 = require("back-lib-common-contracts");
/* istanbul ignore else */
if (!global['ValidationError']) {
    global['ValidationError'] = back_lib_common_contracts_1.ValidationError;
}
/* istanbul ignore else */
if (!global['MinorException']) {
    global['MinorException'] = back_lib_common_util_1.MinorException;
}
/* istanbul ignore else */
if (!global['InternalErrorException']) {
    global['InternalErrorException'] = back_lib_common_util_1.InternalErrorException;
}
// RPC Base classes
let RpcCallerBase = class RpcCallerBase {
    constructor() {
        this._emitter = new events_1.EventEmitter();
        this._timeout = 30000;
    }
    /**
     * @see IRpcCaller.timeout
     */
    get timeout() {
        return this._timeout;
    }
    /**
     * @see IRpcCaller.timeout
     */
    set timeout(val) {
        if (val >= 1000 && val <= 60000) {
            this._timeout = val;
        }
    }
    dispose() {
        this._emitter.removeAllListeners();
        this._emitter = null;
        return Promise.resolve();
    }
    /**
     * @see IRpcCaller.onError
     */
    onError(handler) {
        this._emitter.on('error', handler);
    }
    emitError(err) {
        this._emitter.emit('error', err);
    }
    rebuildError(payload) {
        if (payload.type) {
            // Expect response.payload.type = MinorException | ValidationError
            return new global[payload.type](payload.message);
        }
        else {
            let ex = new back_lib_common_util_1.MinorException(payload.message);
            ex.stack = payload.stack;
            return ex;
        }
    }
};
RpcCallerBase = __decorate([
    back_lib_common_util_1.injectable(),
    __metadata("design:paramtypes", [])
], RpcCallerBase);
exports.RpcCallerBase = RpcCallerBase;
let RpcHandlerBase = class RpcHandlerBase {
    constructor(_depContainer) {
        this._depContainer = _depContainer;
        back_lib_common_util_1.Guard.assertArgDefined('_depContainer', _depContainer);
        this._emitter = new events_1.EventEmitter();
    }
    /**
     * @see IRpcHandler.onError
     */
    onError(handler) {
        this._emitter.on('error', handler);
    }
    emitError(err) {
        this._emitter.emit('error', err);
    }
    createResponse(isSuccess, payload, replyTo) {
        return {
            isSuccess,
            from: this.name,
            to: replyTo,
            payload
        };
    }
    createError(rawError) {
        // TODO: Should log this unexpected error.
        let errObj = {};
        if (rawError instanceof back_lib_common_util_1.MinorException) {
            // If this is a minor error, or the action method sends this error
            // back to caller on purpose.
            errObj.type = rawError.name;
            errObj.message = rawError.message;
            errObj.detail = rawError['details'];
        }
        else if ((rawError instanceof Error) || (rawError instanceof back_lib_common_util_1.Exception)) {
            // If error is an uncaught Exception/Error object, that means the action method
            // has a problem. We should not send it back to caller.
            errObj.type = 'InternalErrorException';
            errObj.message = rawError.message;
            this.emitError(rawError);
        }
        else {
            let ex = new back_lib_common_util_1.MinorException(rawError + '');
            errObj.type = 'InternalErrorException';
            this.emitError(ex.message);
        }
        return errObj;
    }
};
RpcHandlerBase = __decorate([
    back_lib_common_util_1.injectable(),
    __metadata("design:paramtypes", [Object])
], RpcHandlerBase);
exports.RpcHandlerBase = RpcHandlerBase;

//# sourceMappingURL=RpcCommon.js.map
