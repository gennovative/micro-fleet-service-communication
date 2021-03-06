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
const { Service: S } = common_1.constants;
/**
 * Base class for MediateRpcAddOn.
 */
let MediateRpcHandlerAddOnBase = class MediateRpcHandlerAddOnBase {
    constructor(_configProvider, _rpcHandler) {
        this._configProvider = _configProvider;
        this._rpcHandler = _rpcHandler;
        common_1.Guard.assertArgDefined('_configProvider', _configProvider);
        common_1.Guard.assertArgDefined('_rpcHandler', _rpcHandler);
    }
    /**
     * @see IServiceAddOn.init
     */
    async init() {
        await this._rpcHandler.init({
            handlerName: this._configProvider.get(S.SERVICE_SLUG).value,
        });
        this._errorHandler && this._rpcHandler.onError(this._errorHandler);
        await this.handleRequests();
        await this._rpcHandler.start();
    }
    /**
     * @see IServiceAddOn.deadLetter
     */
    deadLetter() {
        return this._rpcHandler.pause();
        // .then(() => this._rpcHandler.dispose())
    }
    /**
     * @see IServiceAddOn.dispose
     */
    async dispose() {
        this._configProvider = null;
        await this._rpcHandler.dispose();
        this._rpcHandler = null;
        return Promise.resolve();
    }
    /**
     * Registers a listener to handle errors.
     */
    onError(handler) {
        this._errorHandler = handler;
        return this;
    }
};
MediateRpcHandlerAddOnBase = __decorate([
    common_1.decorators.injectable(),
    __param(0, common_1.decorators.unmanaged()),
    __param(1, common_1.decorators.unmanaged()),
    __metadata("design:paramtypes", [Object, Object])
], MediateRpcHandlerAddOnBase);
exports.MediateRpcHandlerAddOnBase = MediateRpcHandlerAddOnBase;
//# sourceMappingURL=MediateRpcHandlerAddOnBase.js.map