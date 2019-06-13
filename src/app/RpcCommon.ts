import { EventEmitter } from 'events'

import { injectable, IDependencyContainer, CriticalException,
    MinorException, Exception, InternalErrorException,
    ValidationError } from '@micro-fleet/common'


const descriptor = {
    writable: false,
    enumerable: false,
    configurable: false,
    value: null as any,
}

if (!global.gennova) {
    descriptor.value = {}
    Object.defineProperty(global, 'gennova', descriptor)
}

const gennova = global.gennova

/* istanbul ignore else */
if (!gennova['ValidationError']) {
    descriptor.value = ValidationError
    Object.defineProperty(gennova, 'ValidationError', descriptor)
}

/* istanbul ignore else */
if (!gennova['MinorException']) {
    descriptor.value = MinorException
    Object.defineProperty(gennova, 'MinorException', descriptor)
}

/* istanbul ignore else */
if (!gennova['CriticalException']) {
    descriptor.value = CriticalException
    Object.defineProperty(gennova, 'CriticalException', descriptor)
}

/* istanbul ignore else */
if (!gennova['InternalErrorException']) {
    descriptor.value = InternalErrorException
    Object.defineProperty(gennova, 'InternalErrorException', descriptor)
}

export type HandlerRejection = {
    isIntended: boolean,
    reason: any,
}


export type RpcError = {
    type: string,
    message?: string,
    details?: any,
}

// Interface - Service contract

export type RpcRequest = {
    from: string
    to: string
    payload: any
}

export type RpcResponse = {
    isSuccess: boolean
    from: string
    to: string
    payload: any
}

// Interface - RPC caller and handler

export interface IRpcCaller {
    /**
     * A name used in "from" and "to" request property.
     */
    name: string

    /**
     * Number of milliseconds to wait for response before cancelling the request.
     * Must be between (inclusive) 1000 and 60000 (Min: 1s, Max: 60s).
     */
    timeout: number

    /**
     * Sets up this RPC caller with specified `param`. Each implementation class requires
     * different kinds of `param`.
     */
    init(params?: any): any

    /**
     * Clear resources.
     */
    dispose(): Promise<void>

    /**
     * Sends a request to `moduleName` to execute `action` with `params`.
     * @param moduleName The module to send request.
     * @param action The function name to call on `moduleName`.
     * @param params Parameters to pass to function `action`.
     */
    call(moduleName: string, action: string, params?: any): Promise<RpcResponse>

    /**
     * Registers a listener to handle errors.
     */
    onError(handler: (err: any) => void): void
}


export type RpcHandlerParams = {
    /**
     * The data being sent.
     */
    payload: any,

    /**
     * Responds with success state.
     */
    resolve: PromiseResolveFn,

    /**
     * Responds with failure state.
     */
    reject: PromiseRejectFn,

    /**
     * The RPC request that contains payload.
     */
    rpcRequest: RpcRequest,

    /**
     * Is either raw HTTP request (direct RPC) or raw Message broker message
     */
    rawMessage: any
}

export type RpcHandlerFunction = (params: RpcHandlerParams) => any

export interface IRpcHandler {
    /**
     * A name used in "from" and "to" request property.
     */
    name: string

    /**
     * Sets up this RPC handler with specified `param`. Each implementation class requires
     * different kinds of `param`.
     */
    init(params?: any): any

    /**
     * Waits for incoming request, resolves an instance with `dependencyIdentifier`,
     * calls instance's `action` method. If `customAction` is specified,
     * calls instance's `customAction` instead.
     */
    handle(module: string, actionName: string, handler: RpcHandlerFunction): any | Promise<any>

    /**
     * Registers a listener to handle errors.
     */
    onError(handler: (err: any) => void): void

    /**
     * Starts listening to requests.
     */
    start(): Promise<void>

    /**
     * Keeps running, but not accepts any more incoming requests.
     */
    pause(): Promise<void>

    /**
     * Continues to accept incoming requests.
     */
    resume(): Promise<void>

    /**
     * Stops handling requests and removes registered actions.
     */
    dispose(): Promise<void>

    /**
     * Registers a listener to handle errors.
     */
    onError(handler: (err: any) => void): void
}


// RPC Base classes

@injectable()
export abstract class RpcCallerBase {

    /**
     * @see IRpcCaller.name
     */
    public name: string

    private _timeout: number

    protected _emitter: EventEmitter


    constructor() {
        this._emitter = new EventEmitter()
        this._timeout = 30000
    }


    /**
     * @see IRpcCaller.timeout
     */
    public get timeout(): number {
        return this._timeout
    }

    /**
     * @see IRpcCaller.timeout
     */
    public set timeout(val: number) {
        if (val >= 1000 && val <= 60000) {
            this._timeout = val
        }
    }

    public dispose(): Promise<void> {
        this._emitter.removeAllListeners()
        this._emitter = null
        return Promise.resolve()
    }

    /**
     * @see IRpcCaller.onError
     */
    public onError(handler: (err: any) => void): void {
        this._emitter.on('error', handler)
    }


    protected emitError(err: any): void {
        this._emitter.emit('error', err)
    }

    protected rebuildError(error: any) {
        const payload = error.payload ? error.payload : error
        let exception: Exception
        if (payload.type) {
            // Expect response.payload.type = MinorException | ValidationError
            exception = new global.gennova[payload.type](payload.message)
        }
        else {
            exception = new MinorException(payload.message)
        }
        exception.stack = payload.stack
        exception['details'] = payload['details']
        return exception
    }
}

@injectable()
export abstract class RpcHandlerBase {

    /**
     * @see IRpcHandler.name
     */
    public name: string

    protected _emitter: EventEmitter


    constructor(protected _depContainer?: IDependencyContainer) {
        this._emitter = new EventEmitter()
    }


    /**
     * @see IRpcHandler.onError
     */
    public onError(handler: (err: any) => void): void {
        this._emitter.on('error', handler)
    }


    protected emitError(err: any): void {
        this._emitter.emit('error', err)
    }

    protected createResponse(isSuccess: boolean, payload: any, replyTo: string): RpcResponse {
        return {
            isSuccess,
            from: this.name,
            to: replyTo,
            payload,
        }
    }

    protected createError({ isIntended, reason}: HandlerRejection): RpcError {
        // TODO: Should log this unexpected error.
        const rpcError: RpcError = {
            type: 'InternalErrorException',
        }
        if (!isIntended) {
            // If error type is unidentified, we should not send it back to caller.
            this.emitError(reason)
            return rpcError
        }

        if (reason instanceof Exception) {
            // If this is a minor error, or the action method sends this error
            // back to caller on purpose.
            rpcError.type = reason.name
            rpcError.message = reason.message
            rpcError.details = reason['details'] // In case of ValidationError
        }
        else {
            // If error is an uncaught Exception/Error object, that means the action method
            // has a problem. We should not send it back to caller.
            rpcError.type = 'MinorException'
            rpcError.message = reason.message
            rpcError.details = reason
        }
        return rpcError
    }
}
