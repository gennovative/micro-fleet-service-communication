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
const back_lib_common_util_1 = require("back-lib-common-util");
// RPC Base classes
let RpcCallerBase = class RpcCallerBase {
    get name() {
        return this._name;
    }
    set name(val) {
        this._name = val;
    }
};
RpcCallerBase = __decorate([
    back_lib_common_util_1.injectable()
], RpcCallerBase);
exports.RpcCallerBase = RpcCallerBase;
let RpcHandlerBase = class RpcHandlerBase {
    constructor(_depContainer) {
        this._depContainer = _depContainer;
    }
    get name() {
        return this._name;
    }
    set name(val) {
        this._name = val;
    }
    resolveActionFunc(action, depId, actFactory) {
        // Attempt to resolve controller instance
        let instance = this._depContainer.resolve(depId);
        back_lib_common_util_1.Guard.assertIsTruthy(instance, `Cannot resolve dependency ${depId.toString()}!`);
        let actionFn = instance[action];
        // If default action is not available, attempt to get action from factory.
        if (!actionFn) {
            actionFn = (actFactory ? actFactory(instance) : null);
        }
        back_lib_common_util_1.Guard.assertIsTruthy(actionFn, 'Specified action does not exist in controller!');
        return actionFn.bind(instance);
    }
    createResponse(isSuccess, data, replyTo) {
        return {
            isSuccess,
            from: this._name,
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
