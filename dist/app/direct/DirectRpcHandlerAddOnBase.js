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
const common_1 = require("@micro-fleet/common");
const { RpcSettingKeys: RpcS, SvcSettingKeys: SvcS } = common_1.constants;
/**
 * Base class for DirectRpcAddOn.
 */
let DirectRpcHandlerAddOnBase = class DirectRpcHandlerAddOnBase {
    constructor(_configProvider, _rpcHandler) {
        this._configProvider = _configProvider;
        this._rpcHandler = _rpcHandler;
        common_1.Guard.assertArgDefined('_configProvider', _configProvider);
        common_1.Guard.assertArgDefined('_rpcHandler', _rpcHandler);
    }
    /**
     * @see IServiceAddOn.init
     */
    init() {
        this._rpcHandler.name = this._configProvider.get(SvcS.SERVICE_SLUG).value;
        this._rpcHandler.port = this._configProvider.get(RpcS.RPC_HANDLER_PORT).value;
        this._rpcHandler.init();
        return this.handleRequests()
            .then(() => this._rpcHandler.start());
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
        const handler = this._rpcHandler;
        this._rpcHandler = null;
        return handler.dispose();
    }
};
DirectRpcHandlerAddOnBase = __decorate([
    common_1.injectable(),
    __param(0, common_1.unmanaged()),
    __param(1, common_1.unmanaged()),
    __metadata("design:paramtypes", [Object, Object])
], DirectRpcHandlerAddOnBase);
exports.DirectRpcHandlerAddOnBase = DirectRpcHandlerAddOnBase;
//# sourceMappingURL=DirectRpcHandlerAddOnBase.js.map