"use strict";
/// <reference types="reflect-metadata" />
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
const controller_1 = require("../constants/controller");
const Types_1 = require("../constants/Types");
const MetaData_1 = require("../constants/MetaData");
const MediateRpcHandlerAddOnBase_1 = require("./MediateRpcHandlerAddOnBase");
const ControllerHunter_1 = require("../ControllerHunter");
/**
 * Automatically registers classes decorated with `@directController()`
 */
let DefaultMediateRpcHandlerAddOn = class DefaultMediateRpcHandlerAddOn extends MediateRpcHandlerAddOnBase_1.MediateRpcHandlerAddOnBase {
    constructor(configProvider, _depContainer, rpcHandler) {
        super(configProvider, rpcHandler);
        this._depContainer = _depContainer;
        this.name = 'DefaultMediateRpcHandlerAddOn';
        common_1.Guard.assertArgDefined('_depContainer', _depContainer);
        this._controllerHunter = new ControllerHunter_1.ControllerHunter(_depContainer, rpcHandler, MetaData_1.MetaData.CONTROLLER_MEDIATE, controller_1.ControllerCreationStrategy.SINGLETON);
    }
    /**
     * Gets or sets strategy when creating controller instance.
     */
    get controllerCreation() {
        return this._controllerHunter.controllerCreation;
    }
    set controllerCreation(val) {
        this._controllerHunter.controllerCreation = val;
    }
    /**
     * Gets or sets path to folder containing controller classes.
     */
    get controllerPath() {
        return this._controllerHunter.controllerPath;
    }
    set controllerPath(val) {
        this._controllerHunter.controllerPath = val;
    }
    /**
     * @override
     */
    async handleRequests() {
        await this._controllerHunter.hunt();
    }
};
DefaultMediateRpcHandlerAddOn = __decorate([
    common_1.injectable(),
    __param(0, common_1.inject(common_1.Types.CONFIG_PROVIDER)),
    __param(1, common_1.inject(common_1.Types.DEPENDENCY_CONTAINER)),
    __param(2, common_1.inject(Types_1.Types.MEDIATE_RPC_HANDLER)),
    __metadata("design:paramtypes", [Object, Object, Object])
], DefaultMediateRpcHandlerAddOn);
exports.DefaultMediateRpcHandlerAddOn = DefaultMediateRpcHandlerAddOn;
//# sourceMappingURL=DefaultMediateRpcHandlerAddOn.js.map