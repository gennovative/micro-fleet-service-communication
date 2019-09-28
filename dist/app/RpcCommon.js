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
const common_1 = require("@micro-fleet/common");
const descriptor = {
    writable: false,
    enumerable: false,
    configurable: false,
    value: null,
};
/* istanbul ignore else */
if (!global['gennova']) {
    descriptor.value = {};
    Object.defineProperty(global, 'gennova', descriptor);
}
const gennova = global['gennova'];
/* istanbul ignore else */
if (!gennova['BusinessInvariantError']) {
    descriptor.value = common_1.BusinessInvariantError;
    Object.defineProperty(gennova, 'BusinessInvariantError', descriptor);
}
/* istanbul ignore else */
if (!gennova['ValidationError']) {
    descriptor.value = common_1.ValidationError;
    Object.defineProperty(gennova, 'ValidationError', descriptor);
}
/* istanbul ignore else */
if (!gennova['MinorException']) {
    descriptor.value = common_1.MinorException;
    Object.defineProperty(gennova, 'MinorException', descriptor);
}
/* istanbul ignore else */
if (!gennova['CriticalException']) {
    descriptor.value = common_1.CriticalException;
    Object.defineProperty(gennova, 'CriticalException', descriptor);
}
/* istanbul ignore else */
if (!gennova['InternalErrorException']) {
    descriptor.value = common_1.InternalErrorException;
    Object.defineProperty(gennova, 'InternalErrorException', descriptor);
}
// RPC Base classes
let RpcCallerBase = class RpcCallerBase {
    constructor() {
        this.$emitter = new events_1.EventEmitter();
        this.$timeout = 30e3;
    }
    /**
     * @see IRpcCaller.name
     */
    get name() {
        return this.$name;
    }
    /**
     * @see IRpcCaller.timeout
     */
    get timeout() {
        return this.$timeout;
    }
    dispose() {
        this.$emitter.removeAllListeners();
        this.$emitter = null;
        return Promise.resolve();
    }
    /**
     * @see IRpcCaller.onError
     */
    onError(handler) {
        this.$emitter.on('error', handler);
    }
    $emitError(err) {
        this.$emitter.emit('error', err);
    }
    $rebuildError(error) {
        if (!error.type) {
            return error;
        }
        const ExceptionClass = global['gennova'][error.type];
        if (!ExceptionClass) {
            return error;
        }
        // Expect response.payload.type = MinorException | ValidationError...
        const exception = new ExceptionClass(error.message);
        exception.details = (typeof error.details === 'string')
            ? JSON.parse(error.details)
            : error.details;
        return exception;
    }
};
RpcCallerBase = __decorate([
    common_1.decorators.injectable(),
    __metadata("design:paramtypes", [])
], RpcCallerBase);
exports.RpcCallerBase = RpcCallerBase;
let RpcHandlerBase = class RpcHandlerBase {
    constructor() {
        this.$emitter = new events_1.EventEmitter();
        this._hasErrHandler = false;
    }
    /**
     * @see IRpcHandler.name
     */
    get name() {
        return this.$name;
    }
    /**
     * @see IRpcHandler.onError
     */
    onError(handler) {
        this.$emitter.on('error', handler);
        this._hasErrHandler = true;
    }
    $emitError(err) {
        if (!this._hasErrHandler) {
            console.warn('No error handler registered. Emitted error will be thrown as exception.');
        }
        this.$emitter.emit('error', err);
    }
    $createResponse(isSuccess, payload, replyTo) {
        return {
            isSuccess,
            from: this.name,
            to: replyTo,
            payload,
        };
    }
    $createError({ isIntended, reason }) {
        // TODO: Should log this unexpected error.
        const rpcError = {
            type: 'InternalErrorException',
        };
        if (!isIntended) {
            // If this error is unintended, we should not send it back to caller.
            return rpcError;
        }
        if (reason instanceof common_1.Exception) {
            // If this error is intended, send this error back to caller to blame it.
            rpcError.type = reason.name;
            rpcError.message = reason.message;
            rpcError.details = reason.details; // In case of ValidationError
        }
        else {
            // If this error is intended but has no type, we cast it to MinorException.
            rpcError.type = 'MinorException';
            if (typeof reason === 'string') {
                rpcError.message = reason;
            }
            else {
                rpcError.details = JSON.stringify(reason);
            }
        }
        return rpcError;
    }
};
RpcHandlerBase = __decorate([
    common_1.decorators.injectable(),
    __metadata("design:paramtypes", [])
], RpcHandlerBase);
exports.RpcHandlerBase = RpcHandlerBase;
//# sourceMappingURL=RpcCommon.js.map