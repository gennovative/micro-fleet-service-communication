"use strict";
/// <reference types="back-lib-common-constants" />
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
const back_lib_common_constants_1 = require("back-lib-common-constants");
const back_lib_common_util_1 = require("back-lib-common-util");
/**
 * Base class for DirectRpcAddOn.
 */
let DirectRpcHandlerAddOnBase = class DirectRpcHandlerAddOnBase {
    constructor(_configProvider, _rpcHandler) {
        this._configProvider = _configProvider;
        this._rpcHandler = _rpcHandler;
        back_lib_common_util_1.Guard.assertArgDefined('_configProvider', _configProvider);
        back_lib_common_util_1.Guard.assertArgDefined('_rpcHandler', _rpcHandler);
    }
    /**
     * @see IServiceAddOn.init
     */
    init(moduleName = null) {
        this._rpcHandler.module = moduleName;
        this._rpcHandler.name = this._configProvider.get(back_lib_common_constants_1.SvcSettingKeys.SERVICE_SLUG);
        this._rpcHandler.port = this._configProvider.get(back_lib_common_constants_1.RpcSettingKeys.RPC_HANDLER_PORT);
        this._rpcHandler.init();
        this.handleRequests();
        return this._rpcHandler.start();
    }
    /**
     * @see IServiceAddOn.deadLetter
     */
    deadLetter() {
        return Promise.resolve();
    }
    /**
     * @see IServiceAddOn.dispose
     */
    dispose() {
        this._configProvider = null;
        let handler = this._rpcHandler;
        this._rpcHandler = null;
        return handler.dispose();
    }
    handleRequests() {
    }
};
DirectRpcHandlerAddOnBase = __decorate([
    back_lib_common_util_1.injectable(),
    __metadata("design:paramtypes", [Object, Object])
], DirectRpcHandlerAddOnBase);
exports.DirectRpcHandlerAddOnBase = DirectRpcHandlerAddOnBase;

//# sourceMappingURL=DirectRpcHandlerAddOnBase.js.map
