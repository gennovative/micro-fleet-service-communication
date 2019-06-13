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
const path = require("path");
const common_1 = require("@micro-fleet/common");
const DirectRpcHandlerAddOnBase_1 = require("./DirectRpcHandlerAddOnBase");
const controller_1 = require("../constants/controller");
const Types_1 = require("../Types");
const MetaData_1 = require("../constants/MetaData");
/**
 * Base class for DirectRpcAddOn.
 */
let DefaultDirectRpcHandlerAddOn = class DefaultDirectRpcHandlerAddOn extends DirectRpcHandlerAddOnBase_1.DirectRpcHandlerAddOnBase {
    constructor(configProvider, _depContainer, rpcHandler) {
        super(configProvider, rpcHandler);
        this._depContainer = _depContainer;
        this.name = 'DefaultDirectRpcHandlerAddOn';
        common_1.Guard.assertArgDefined('_depContainer', _depContainer);
        this.controllerCreation = controller_1.ControllerCreationStrategy.SINGLETON;
    }
    /**
     * @see IServiceAddOn.deadLetter
     */
    deadLetter() {
        this._rpcHandler.pause();
        return Promise.resolve();
    }
    /**
     * @override
     */
    async handleRequests() {
        const controllers = await this._loadControllers();
        this._initControllers(controllers);
    }
    /**
     * Registers a listener to handle errors.
     */
    onError(handler) {
        this._rpcHandler.onError(handler);
    }
    //#region Controller
    async _loadControllers() {
        const ctrlPath = this.controllerPath || path.join(process.cwd(), 'dist', 'app', 'controllers');
        return await Promise.resolve().then(() => require(ctrlPath)) || {};
    }
    _initControllers(controllers) {
        for (const ctrlName of Object.getOwnPropertyNames(controllers)) {
            const CtrlClass = controllers[ctrlName];
            if (typeof CtrlClass !== 'function') {
                continue;
            }
            this._assertValidController(ctrlName, CtrlClass);
            const bound = this._depContainer.bind(CtrlClass.name, CtrlClass);
            if (this.controllerCreation == controller_1.ControllerCreationStrategy.SINGLETON) {
                bound.asSingleton();
            }
            const moduleName = this._extractModuleName(CtrlClass);
            this._initActions(CtrlClass, moduleName);
        }
    }
    _extractModuleName(CtrlClass) {
        const [moduleName] = this._getMetadata(MetaData_1.MetaData.CONTROLLER_DIRECT, CtrlClass);
        return moduleName;
    }
    _assertValidController(ctrlName, CtrlClass) {
        if (typeof CtrlClass !== 'function' || !Reflect.hasOwnMetadata(MetaData_1.MetaData.CONTROLLER_DIRECT, CtrlClass)) {
            throw new common_1.CriticalException(`Controller "${ctrlName}" must be a class and decorated with @controller()`);
        }
    }
    //#endregion Controller
    //#region Action
    _initActions(CtrlClass, moduleName) {
        const allFunctions = new Map();
        // Iterates over all function backwards prototype chain, except root Object.prototype
        for (let proto = CtrlClass.prototype; proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
            for (const actionName of Object.getOwnPropertyNames(proto)) {
                // Make sure function in super class never overides function in derives class.
                if (allFunctions.has(actionName)) {
                    continue;
                }
                const actionFunc = this._extractActionFromPrototype(proto, actionName);
                if (!actionFunc.hasValue) {
                    continue;
                }
                allFunctions.set(actionName, actionFunc.value);
            }
        }
        // Destructuring to get second element (expected: [key, value])
        // tslint:disable-next-line:prefer-const
        for (let [, actFn] of allFunctions) {
            const proxyFn = this._proxyActionFunc(actFn, CtrlClass);
            const route = this._extractActionRoute(CtrlClass, actFn.name);
            this._rpcHandler.handle(moduleName, route, proxyFn);
        }
    }
    _extractActionRoute(CtrlClass, funcName) {
        const [actionRoute] = this._getMetadata(MetaData_1.MetaData.ACTION, CtrlClass, funcName);
        return actionRoute;
    }
    _extractActionFromPrototype(prototype, name) {
        if (!prototype || !name) {
            return new common_1.Maybe;
        }
        const isGetSetter = (proto, funcName) => {
            const desc = Object.getOwnPropertyDescriptor(proto, funcName);
            return (desc && (desc.get || desc.set));
        };
        const func = prototype[name];
        const isPureFunction = (name !== 'constructor') && (typeof func === 'function') && !isGetSetter(prototype, name);
        const isDecorated = Reflect.hasMetadata(MetaData_1.MetaData.ACTION, prototype.constructor, name);
        return isPureFunction && isDecorated ? new common_1.Maybe(func) : new common_1.Maybe;
    }
    _proxyActionFunc(actionFunc, CtrlClass) {
        // Returns a proxy function that resolves the actual action function in EVERY incomming request.
        // If Controller Creation Strategy is SINGLETON, then the same controller instance will handle all requests.
        // Otherwise, a new controller instance will be created for each request.
        return common_1.HandlerContainer.instance.register(actionFunc.name, CtrlClass.name, (ctrlInstance, actionName) => (...args) => ctrlInstance[actionName](...args));
    }
    //#endregion Action
    _getMetadata(metaKey, classOrProto, propName) {
        return (propName)
            ? Reflect.getMetadata(metaKey, classOrProto, propName)
            : Reflect.getOwnMetadata(metaKey, classOrProto);
    }
};
DefaultDirectRpcHandlerAddOn = __decorate([
    common_1.injectable(),
    __param(0, common_1.inject(common_1.Types.CONFIG_PROVIDER)),
    __param(1, common_1.inject(common_1.Types.DEPENDENCY_CONTAINER)),
    __param(2, common_1.inject(Types_1.Types.DIRECT_RPC_HANDLER)),
    __metadata("design:paramtypes", [Object, Object, Object])
], DefaultDirectRpcHandlerAddOn);
exports.DefaultDirectRpcHandlerAddOn = DefaultDirectRpcHandlerAddOn;
//# sourceMappingURL=DefaultDirectRpcHandlerAddOn.js.map