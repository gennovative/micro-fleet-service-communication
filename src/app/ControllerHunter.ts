import * as path from 'path'

import { IDependencyContainer, Guard, CriticalException,
    Maybe, HandlerContainer, Newable } from '@micro-fleet/common'

import { ControllerCreationStrategy, ControllerExports } from './constants/controller'
import { MetaData } from './constants/MetaData'
import { ParamDecorDescriptor } from './decorators/param-decor-base'
import { RESOLVE_INJECTED } from './decorators/resolveFn'
import { REJECT_INJECTED } from './decorators/rejectFn'
import { IRpcHandler, RpcHandlerFunction, RpcHandlerParams } from './RpcCommon'
import { ActionMetadata } from './decorators/action'


export class ControllerHunter {

    /**
     * Gets or sets strategy when creating controller instance.
     */
    public controllerCreation: ControllerCreationStrategy

    /**
     * Gets or sets path to folder containing controller classes.
     */
    public controllerPath: string


    constructor(
        private _depContainer: IDependencyContainer,
        private _rpcHandler: IRpcHandler,
        private _controllerMeta: string,
        creationStrategy: ControllerCreationStrategy,
    ) {
        Guard.assertArgDefined('_depContainer', _depContainer)

        this.controllerCreation = creationStrategy
    }

    /**
     * Scans "controllerPath" and registers controller classes
     * decorated with "controllerMeta".
     */
    public async hunt(): Promise<void> {
        const controllers = await this._loadControllers()
        await this._initControllers(controllers)
    }


    //#region Controller

    protected async _loadControllers(): Promise<ControllerExports> {
        const ctrlPath = this.controllerPath || path.join(process.cwd(), 'dist', 'app', 'controllers')
        return await import(ctrlPath) || {}
    }

    protected async _initControllers(controllers: ControllerExports): Promise<void> {
        for (const ctrlName of Object.getOwnPropertyNames(controllers)) {
            const CtrlClass = controllers[ctrlName]
            if (typeof CtrlClass !== 'function') { continue }
            this._assertValidController(ctrlName, CtrlClass)

            const bound = this._depContainer.bindConstructor(CtrlClass.name, CtrlClass)
            if (this.controllerCreation == ControllerCreationStrategy.SINGLETON) {
                bound.asSingleton()
            }

            const moduleName = this._extractModuleName(CtrlClass)
            await this._initActions(CtrlClass, moduleName)
        }
    }

    protected _extractModuleName(CtrlClass: Newable): string {
        const [moduleName]: [string] = this._getMetadata(this._controllerMeta, CtrlClass)
        return moduleName
    }

    protected _assertValidController(ctrlName: string, CtrlClass: Newable): void {
        if (typeof CtrlClass !== 'function' || !Reflect.hasOwnMetadata(this._controllerMeta, CtrlClass)) {
            throw new CriticalException(`Controller "${ctrlName}" must be a class and decorated with meta data ${this._controllerMeta}`)
        }
    }

    //#endregion Controller


    //#region Action

    protected async _initActions(CtrlClass: Newable, moduleName: string): Promise<void> {
        const allFunctions = new Map<string, Function>()
        // Iterates over all function backwards prototype chain, except root Object.prototype
        for (let proto = CtrlClass.prototype; proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
            for (const actionName of Object.getOwnPropertyNames(proto)) {
                // Make sure function in super class never overides function in derives class.
                if (allFunctions.has(actionName)) { continue }

                const actionFunc = this._extractActionFromPrototype(proto, actionName)
                if (actionFunc.isNothing) { continue }

                allFunctions.set(actionName, actionFunc.value)
            }
        }
        // Destructuring to get second element (expected: [key, value])
        // tslint:disable-next-line:prefer-const
        for (let [, actFn] of allFunctions) {
            const proxyFn = this._proxyActionFunc(actFn, CtrlClass)
            const metadata = this._extractActionMetadata(CtrlClass, actFn.name)
            await this._rpcHandler.handle({
                moduleName,
                actionName: metadata.isRawDest ? null : metadata.name,
                rawDest: metadata.isRawDest ? metadata.name : null,
                handler: proxyFn,
            })
        }
    }

    protected _extractActionMetadata(CtrlClass: Newable, funcName: string): ActionMetadata {
        return this._getMetadata(MetaData.ACTION, CtrlClass, funcName)

    }

    protected _extractActionFromPrototype(prototype: any, name: string): Maybe<RpcHandlerFunction> {
        if (!prototype || !name) { return Maybe.Nothing() }

        const isGetSetter = (proto: any, funcName: string) => {
            const desc = Object.getOwnPropertyDescriptor(proto, funcName)
            return (desc && (desc.get || desc.set))
        }
        const func = prototype[name]
        const isPureFunction = (name !== 'constructor') && (typeof func === 'function') && !isGetSetter(prototype, name)
        const isDecorated = Reflect.hasMetadata(MetaData.ACTION, prototype.constructor, name)
        return isPureFunction && isDecorated ? Maybe.Just(func) : Maybe.Nothing()
    }


    protected _proxyActionFunc(actionFunc: Function, CtrlClass: Newable): RpcHandlerFunction {
        // Returns a proxy function that resolves the actual action function in EVERY incomming request.
        // If Controller Creation Strategy is SINGLETON, then the same controller instance will handle all requests.
        // Otherwise, a new controller instance will be created for each request.
        return HandlerContainer.instance.register(
            actionFunc.name,
            CtrlClass.name,
            (ctrlInstance, actionName) => {
                const thisHunter = this

                return async function(params: RpcHandlerParams) {
                    const args = await thisHunter._resolveParamValues(CtrlClass, actionName, params)
                    const actionResult = await ctrlInstance[actionName].apply(ctrlInstance, args)
                    thisHunter._autoResolve(actionResult, params)
                }
            }
        ) as RpcHandlerFunction
    }

    protected async _resolveParamValues(CtrlClass: Newable, actionName: string, params: RpcHandlerParams): Promise<any[]> {
        const paramDecors: ParamDecorDescriptor = this._getMetadata(MetaData.PARAM_DECOR, CtrlClass, actionName)
        const args: any = []
        if (paramDecors) {
            for (let i = 0; i < paramDecors.length; ++i) {
                if (typeof paramDecors[i] === 'function') {
                    const result: any = paramDecors[i].call(this, params)
                    args[i] = await result
                } else {
                    args[i] = undefined
                }
            }
        }
        return args
    }

    protected _autoResolve(actionResult: any, params: RpcHandlerParams): void {
        if (!params[RESOLVE_INJECTED] && !params[REJECT_INJECTED]) {
            params.resolve(actionResult)
        }
        // Else, skip if resolve function is injected with @resolveFn
    }

    // protected _autoReject(actionResult: any, reject: Function): void {
    //     if (!reject['REJECT_INJECTED']) {
    //         reject(actionResult)
    //     }
    //     // Else, skip if reject function is injected with @rejectFn
    // }

    //#endregion Action



    protected _getMetadata(metaKey: string, classOrProto: any, propName?: string): any {
        return (propName)
            ? Reflect.getMetadata(metaKey, classOrProto, propName)
            : Reflect.getOwnMetadata(metaKey, classOrProto)
    }
}
