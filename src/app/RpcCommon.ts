import { EventEmitter } from 'events'

import { CriticalException, decorators as d,
    MinorException, Exception, InternalErrorException,
    ValidationError, BusinessInvariantError } from '@micro-fleet/common'


const descriptor = {
    writable: false,
    enumerable: false,
    configurable: false,
    value: null as any,
}

/* istanbul ignore else */
if (!global['gennova']) {
    descriptor.value = {}
    Object.defineProperty(global, 'gennova', descriptor)
}

const gennova = global['gennova']

/* istanbul ignore else */
if (!gennova['BusinessInvariantError']) {
    descriptor.value = BusinessInvariantError
    Object.defineProperty(gennova, 'BusinessInvariantError', descriptor)
}

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


export type RpcCallerOptions = {
    /**
     * Module name.
     * Is optionally used to build destination address.
     */
    moduleName?: string,

    /**
     * Action name.
     * Is optionally used to build destination address.
     */
    actionName?: string,

    /**
     * Destination address. If specified, this is used
     * instead of building from `moduleName` and `actionName`.
     */
    rawDest?: string,

    /**
     * Parameters to pass to function `actionName`
     */
    params?: any,
}


// Interface - RPC caller and handler

export interface IRpcCaller {
    /**
     * A name used in "from" and "to" request property.
     */
    readonly name: string

    /**
     * Number of milliseconds to wait for response before cancelling the request.
     * Must be between (inclusive) 1000 and 60000 (Min: 1s, Max: 60s).
     */
    readonly timeout: number

    /**
     * Sets up this RPC caller with specified `param`. Each implementation class requires
     * different kinds of `param`.
     */
    init(params?: any): Promise<void>

    /**
     * Clear resources.
     */
    dispose(): Promise<void>

    /**
     * Sends a request to `moduleName` to execute `action` with `params`,
     * then WAITS for response.
     */
    call(options: RpcCallerOptions): Promise<RpcResponse>

    /**
     * Sends a request to `moduleName` to execute `action` with `params`,
     * WITHOUT waiting for response.
     */
    callImpatient(options: RpcCallerOptions): Promise<void>

    /**
     * Registers a listener to handle errors.
     */
    onError(handler: (err: any) => void): void
}


export type RpcHandleOptions = {
    /**
     * Module name.
     * Is used to identify handers, and optionally to build destination address.
     */
    moduleName: string,

    /**
     * Action name.
     * Is used to identify handers, and optionally to build destination address.
     */
    actionName: string,

    /**
     * Destination address. If specified, this is used
     * instead of building from `moduleName` and `actionName`.
     */
    rawDest?: string,

    /**
     * Function to handle incoming packages.
     */
    handler: RpcHandlerFunction,
}

export type RpcHandlerParams = {
    /**
     * The data being sent.
     */
    payload: any,

    /**
     * Responds with success state.
     */
    resolve: Function,

    /**
     * Responds with failure state.
     */
    reject: Function,

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
    readonly name: string

    /**
     * Sets up this RPC handler with specified `param`. Each implementation class requires
     * different kinds of `param`.
     */
    init(params?: any): Promise<void>

    /**
     * Waits for incoming request, calls registered handler on message coming.
     */
    handle(options: RpcHandleOptions): Promise<void>

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

@d.injectable()
export abstract class RpcCallerBase {

    protected $name: string

    protected $timeout: number

    protected $emitter: EventEmitter


    constructor() {
        this.$emitter = new EventEmitter()
        this.$timeout = 30e3
    }


    /**
     * @see IRpcCaller.name
     */
    public get name(): string {
        return this.$name
    }

    /**
     * @see IRpcCaller.timeout
     */
    public get timeout(): number {
        return this.$timeout
    }


    public dispose(): Promise<void> {
        this.$emitter.removeAllListeners()
        this.$emitter = null
        return Promise.resolve()
    }

    /**
     * @see IRpcCaller.onError
     */
    public onError(handler: (err: any) => void): void {
        this.$emitter.on('error', handler)
    }

    protected $emitError(err: any): void {
        this.$emitter.emit('error', err)
    }

    protected $rebuildError(error: RpcError): any {
        // Expect response.payload.type = MinorException | ValidationError...
        const exception: Exception = new global['gennova'][error.type](error.message)
        exception.details = (typeof error.details === 'string')
            ? JSON.parse(error.details)
            : error.details
        return exception
    }
}

@d.injectable()
export abstract class RpcHandlerBase {

    protected $name: string
    protected $emitter: EventEmitter
    private _hasErrHandler: boolean


    constructor() {
        this.$emitter = new EventEmitter()
        this._hasErrHandler = false
    }


    /**
     * @see IRpcHandler.name
     */
    public get name(): string {
        return this.$name
    }

    /**
     * @see IRpcHandler.onError
     */
    public onError(handler: (err: any) => void): void {
        this.$emitter.on('error', handler)
        this._hasErrHandler = true
    }


    protected $emitError(err: any): void {
        if (!this._hasErrHandler) {
            console.warn('No error handler registered. Emitted error will be thrown as exception.')
        }
        this.$emitter.emit('error', err)
    }

    protected $createResponse(isSuccess: boolean, payload: any, replyTo: string): RpcResponse {
        return {
            isSuccess,
            from: this.name,
            to: replyTo,
            payload,
        }
    }

    protected $createError({ isIntended, reason}: HandlerRejection): RpcError {
        // TODO: Should log this unexpected error.
        const rpcError: RpcError = {
            type: 'InternalErrorException',
        }
        if (!isIntended) {
            // If this error is unintended, we should not send it back to caller.
            return rpcError
        }

        if (reason instanceof Exception) {
            // If this error is intended, send this error back to caller to blame it.
            rpcError.type = reason.name
            rpcError.message = reason.message
            rpcError.details = reason.details // In case of ValidationError
        }
        else {
            // If this error is intended but has no type, we cast it to MinorException.
            rpcError.type = 'MinorException'
            if (typeof reason === 'string') {
                rpcError.message = reason
            }
            else {
                rpcError.details = JSON.stringify(reason)
            }
        }
        return rpcError
    }
}
