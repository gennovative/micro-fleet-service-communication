"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const common_1 = require("@micro-fleet/common");
const controller_1 = require("./constants/controller");
const MetaData_1 = require("./constants/MetaData");
const resolveFn_1 = require("./decorators/resolveFn");
class ControllerHunter {
    constructor(_depContainer, _rpcHandler, _controllerMeta, creationStrategy) {
        this._depContainer = _depContainer;
        this._rpcHandler = _rpcHandler;
        this._controllerMeta = _controllerMeta;
        common_1.Guard.assertArgDefined('_depContainer', _depContainer);
        this.controllerCreation = creationStrategy;
    }
    /**
     * Scans "controllerPath" and registers controller classes
     * decorated with "controllerMeta".
     */
    async hunt() {
        const controllers = await this._loadControllers();
        await this._initControllers(controllers);
    }
    //#region Controller
    async _loadControllers() {
        const ctrlPath = this.controllerPath || path.join(process.cwd(), 'dist', 'app', 'controllers');
        return await Promise.resolve().then(() => require(ctrlPath)) || {};
    }
    async _initControllers(controllers) {
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
            await this._initActions(CtrlClass, moduleName);
        }
    }
    _extractModuleName(CtrlClass) {
        const [moduleName] = this._getMetadata(this._controllerMeta, CtrlClass);
        return moduleName;
    }
    _assertValidController(ctrlName, CtrlClass) {
        if (typeof CtrlClass !== 'function' || !Reflect.hasOwnMetadata(this._controllerMeta, CtrlClass)) {
            throw new common_1.CriticalException(`Controller "${ctrlName}" must be a class and decorated with @mediateController()`);
        }
    }
    //#endregion Controller
    //#region Action
    async _initActions(CtrlClass, moduleName) {
        const allFunctions = new Map();
        // Iterates over all function backwards prototype chain, except root Object.prototype
        for (let proto = CtrlClass.prototype; proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
            for (const actionName of Object.getOwnPropertyNames(proto)) {
                // Make sure function in super class never overides function in derives class.
                if (allFunctions.has(actionName)) {
                    continue;
                }
                const actionFunc = this._extractActionFromPrototype(proto, actionName);
                if (actionFunc.isNothing) {
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
            await this._rpcHandler.handle(moduleName, route, proxyFn);
        }
    }
    _extractActionRoute(CtrlClass, funcName) {
        const [actionRoute] = this._getMetadata(MetaData_1.MetaData.ACTION, CtrlClass, funcName);
        return actionRoute;
    }
    _extractActionFromPrototype(prototype, name) {
        if (!prototype || !name) {
            return common_1.Maybe.Nothing();
        }
        const isGetSetter = (proto, funcName) => {
            const desc = Object.getOwnPropertyDescriptor(proto, funcName);
            return (desc && (desc.get || desc.set));
        };
        const func = prototype[name];
        const isPureFunction = (name !== 'constructor') && (typeof func === 'function') && !isGetSetter(prototype, name);
        const isDecorated = Reflect.hasMetadata(MetaData_1.MetaData.ACTION, prototype.constructor, name);
        return isPureFunction && isDecorated ? common_1.Maybe.Just(func) : common_1.Maybe.Nothing();
    }
    _proxyActionFunc(actionFunc, CtrlClass) {
        // Returns a proxy function that resolves the actual action function in EVERY incomming request.
        // If Controller Creation Strategy is SINGLETON, then the same controller instance will handle all requests.
        // Otherwise, a new controller instance will be created for each request.
        return common_1.HandlerContainer.instance.register(actionFunc.name, CtrlClass.name, (ctrlInstance, actionName) => {
            const thisHunter = this;
            return async function (params) {
                const args = await thisHunter._resolveParamValues(CtrlClass, actionName, params);
                const actionResult = await ctrlInstance[actionName].apply(ctrlInstance, args);
                thisHunter._autoResolve(actionResult, params.resolve);
            };
        });
    }
    async _resolveParamValues(CtrlClass, actionName, params) {
        const paramDecors = this._getMetadata(MetaData_1.MetaData.PARAM_DECOR, CtrlClass, actionName);
        const args = [];
        if (paramDecors) {
            for (let i = 0; i < paramDecors.length; ++i) {
                if (typeof paramDecors[i] === 'function') {
                    const result = paramDecors[i].call(this, params);
                    args[i] = await result;
                }
                else {
                    args[i] = undefined;
                }
            }
        }
        return args;
    }
    _autoResolve(actionResult, resolve) {
        if (!resolve[resolveFn_1.RESOLVE_INJECTED]) {
            resolve(actionResult);
        }
        // Else, skip if resolve function is injected with @resolveFn
    }
    _autoReject(actionResult, reject) {
        if (!reject['REJECT_INJECTED']) {
            reject(actionResult);
        }
        // Else, skip if reject function is injected with @rejectFn
    }
    //#endregion Action
    _getMetadata(metaKey, classOrProto, propName) {
        return (propName)
            ? Reflect.getMetadata(metaKey, classOrProto, propName)
            : Reflect.getOwnMetadata(metaKey, classOrProto);
    }
}
exports.ControllerHunter = ControllerHunter;
//# sourceMappingURL=ControllerHunter.js.map