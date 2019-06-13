/// <reference types="reflect-metadata" />

import * as path from 'path'

import { IConfigurationProvider, inject,
    injectable, Types as cT, CriticalException, Maybe, IDependencyContainer, Guard, HandlerContainer } from '@micro-fleet/common'

import { IDirectRpcHandler } from './DirectRpcHandler'
import { DirectRpcHandlerAddOnBase } from './DirectRpcHandlerAddOnBase'
import { ControllerExports, ControllerCreationStrategy } from '../constants/controller'
import { Types as T } from '../Types'
import { MetaData } from '../constants/MetaData'
import { RpcHandlerFunction } from '../RpcCommon'


/**
 * Base class for DirectRpcAddOn.
 */
@injectable()
export class DefaultDirectRpcHandlerAddOn
    extends DirectRpcHandlerAddOnBase {

    public name: string = 'DefaultDirectRpcHandlerAddOn'

    /**
     * Gets or sets strategy when creating controller instance.
     */
    public controllerCreation: ControllerCreationStrategy

    /**
     * Gets or sets path to folder containing controller classes.
     */
    public controllerPath: string


    constructor(
        @inject(cT.CONFIG_PROVIDER) configProvider: IConfigurationProvider,
        @inject(cT.DEPENDENCY_CONTAINER) protected _depContainer: IDependencyContainer,
        @inject(T.DIRECT_RPC_HANDLER) rpcHandler: IDirectRpcHandler
    ) {
        super(configProvider, rpcHandler)
        Guard.assertArgDefined('_depContainer', _depContainer)

        this.controllerCreation = ControllerCreationStrategy.SINGLETON
    }


    /**
     * @see IServiceAddOn.deadLetter
     */
    public deadLetter(): Promise<void> {
        this._rpcHandler.pause()
        return Promise.resolve()
    }

    /**
     * @override
     */
    protected async handleRequests(): Promise<any> {
        const controllers = await this._loadControllers()
        this._initControllers(controllers)
    }


    /**
     * Registers a listener to handle errors.
     */
    public onError(handler: (err: any) => void): void {
        this._rpcHandler.onError(handler)
    }


    //#region Controller

    protected async _loadControllers(): Promise<ControllerExports> {
        const ctrlPath = this.controllerPath || path.join(process.cwd(), 'dist', 'app', 'controllers')
        return await import(ctrlPath) || {}
    }

    protected _initControllers(controllers: ControllerExports): void {
        for (const ctrlName of Object.getOwnPropertyNames(controllers)) {
            const CtrlClass = controllers[ctrlName]
            if (typeof CtrlClass !== 'function') { continue }
            this._assertValidController(ctrlName, CtrlClass)

            const bound = this._depContainer.bind(CtrlClass.name, CtrlClass)
            if (this.controllerCreation == ControllerCreationStrategy.SINGLETON) {
                bound.asSingleton()
            }

            const moduleName = this._extractModuleName(CtrlClass)
            this._initActions(CtrlClass, moduleName)
        }
    }

    protected _extractModuleName(CtrlClass: Newable): string {
        const [moduleName]: [string] = this._getMetadata(MetaData.CONTROLLER_DIRECT, CtrlClass)
        return moduleName
    }

    protected _assertValidController(ctrlName: string, CtrlClass: Newable): void {
        if (typeof CtrlClass !== 'function' || !Reflect.hasOwnMetadata(MetaData.CONTROLLER_DIRECT, CtrlClass)) {
            throw new CriticalException(`Controller "${ctrlName}" must be a class and decorated with @controller()`)
        }
    }

    //#endregion Controller


    //#region Action

    protected _initActions(CtrlClass: Newable, moduleName: string): void {
        const allFunctions = new Map<string, Function>()
        // Iterates over all function backwards prototype chain, except root Object.prototype
        for (let proto = CtrlClass.prototype; proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
            for (const actionName of Object.getOwnPropertyNames(proto)) {
                // Make sure function in super class never overides function in derives class.
                if (allFunctions.has(actionName)) { continue }

                const actionFunc = this._extractActionFromPrototype(proto, actionName)
                if (!actionFunc.hasValue) { continue }

                allFunctions.set(actionName, actionFunc.value)
            }
        }
        // Destructuring to get second element (expected: [key, value])
        // tslint:disable-next-line:prefer-const
        for (let [, actFn] of allFunctions) {
            const proxyFn = this._proxyActionFunc(actFn, CtrlClass)
            const route = this._extractActionRoute(CtrlClass, actFn.name)
            this._rpcHandler.handle(moduleName, route, proxyFn)
        }
    }

    protected _extractActionRoute(CtrlClass: Newable, funcName: string): string {
        const [actionRoute]: [string] = this._getMetadata(MetaData.ACTION, CtrlClass, funcName)
        return actionRoute

    }

    protected _extractActionFromPrototype(prototype: any, name: string): Maybe<RpcHandlerFunction> {
        if (!prototype || !name) { return new Maybe }

        const isGetSetter = (proto: any, funcName: string) => {
            const desc = Object.getOwnPropertyDescriptor(proto, funcName)
            return (desc && (desc.get || desc.set))
        }
        const func = prototype[name]
        const isPureFunction = (name !== 'constructor') && (typeof func === 'function') && !isGetSetter(prototype, name)
        const isDecorated = Reflect.hasMetadata(MetaData.ACTION, prototype.constructor, name)
        return isPureFunction && isDecorated ? new Maybe(func) : new Maybe
    }


    protected _proxyActionFunc(actionFunc: Function, CtrlClass: Newable): RpcHandlerFunction {
        // Returns a proxy function that resolves the actual action function in EVERY incomming request.
        // If Controller Creation Strategy is SINGLETON, then the same controller instance will handle all requests.
        // Otherwise, a new controller instance will be created for each request.
        return HandlerContainer.instance.register(
            actionFunc.name,
            CtrlClass.name,
            (ctrlInstance, actionName) => (...args: any[]) => ctrlInstance[actionName](...args)
        ) as RpcHandlerFunction
    }

    //#endregion Action



    protected _getMetadata(metaKey: string, classOrProto: any, propName?: string): any {
        return (propName)
            ? Reflect.getMetadata(metaKey, classOrProto, propName)
            : Reflect.getOwnMetadata(metaKey, classOrProto)
    }
}
