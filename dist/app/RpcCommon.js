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
    // protected resolveActionFunc(action: string, depId: string | symbol, actFactory?: ActionFactory): RpcControllerFunction {
    // 	// Attempt to resolve controller instance
    // 	let instance = this._depContainer.resolve<any>(depId);
    // 	Guard.assertIsDefined(instance, `Cannot resolve dependency ${depId.toString()}!`);
    // 	let actionFn = instance[action];
    // 	// If default action is not available, attempt to get action from factory.
    // 	if (!actionFn) {
    // 		actionFn = (actFactory ? actFactory(instance, action) : null);
    // 	}
    // 	Guard.assertIsTruthy(actionFn, 'Specified action does not exist in controller!');
    // 	return actionFn.bind(instance);
    // }
    createResponse(isSuccess, data, replyTo) {
        return {
            isSuccess,
            from: this.name,
            to: replyTo,
            data
        };
    }
};
RpcHandlerBase = __decorate([
    back_lib_common_util_1.injectable(),
    __metadata("design:paramtypes", [Object])
], RpcHandlerBase);
exports.RpcHandlerBase = RpcHandlerBase;

//# sourceMappingURL=RpcCommon.js.map
