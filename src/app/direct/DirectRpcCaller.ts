/// <reference types="debug" />
const debug: debug.IDebugger = require('debug')('mcft:svccom:HttpRpcCaller')

import * as request from 'request-promise-native'
import { decorators as d, Guard, InternalErrorException, MinorException } from '@micro-fleet/common'

import * as rpc from '../RpcCommon'
import { StatusCodeError } from 'request-promise-native/errors'


export type DirectRpcCallerOptions = {
    /**
     * The name used in "from" property of sent messages.
     */
    callerName?: string,

    /**
     * IP address or host name including port number.
     * Do not include protocol (http, ftp...) because different class implementations
     * will prepend different protocols.
     */
    baseAddress?: string
}

export interface IDirectRpcCaller extends rpc.IRpcCaller {
    /**
     * IP address or host name including port number.
     * Do not include protocol (http, ftp...) because different class implementations
     * will prepend different protocols.
     */
    readonly baseAddress: string

    init(options: DirectRpcCallerOptions): Promise<void>
}

@d.injectable()
export class HttpRpcCaller
            extends rpc.RpcCallerBase
            implements IDirectRpcCaller {

    private _baseAddress: string
    private _requestMaker: (options: any) => Promise<any>

    constructor() {
        super()
        this._requestMaker = <any>request
    }

    public get baseAddress(): string {
        return this._baseAddress
    }


    /**
     * @see IRpcCaller.init
     */
    public init(options: DirectRpcCallerOptions): Promise<void> {
        this.$name = options.callerName
        this._baseAddress = options.baseAddress
        return Promise.resolve()
    }

    /**
     * @see IRpcCaller.dispose
     */
    public async dispose(): Promise<void> {
        await super.dispose()
        this._requestMaker = null
    }

    /**
     * @see IRpcCaller.call
     */
    public call({ moduleName, actionName, params, rawDest }: rpc.RpcCallerOptions): Promise<rpc.RpcResponse> {
        if (!rawDest) {
            Guard.assertArgDefined('moduleName', moduleName)
            Guard.assertArgDefined('actionName', actionName)
        }
        Guard.assertIsDefined(this._baseAddress, 'Base URL must be set!')

        const uri = Boolean(rawDest)
            ? `http://${this._baseAddress}/${rawDest}`
            : `http://${this._baseAddress}/${moduleName}/${actionName}`
        debug(`Calling: ${uri}`)
        const rpcRequest: rpc.RpcRequest = {
                from: this.name,
                to: moduleName,
                payload: params,
            },
            options: request.Options = {
                method: 'POST',
                uri,
                body: rpcRequest,
                json: true, // Automatically stringifies the body to JSON
                timeout: this.timeout,
            }

        return this._requestMaker(options)
            .then((res: rpc.RpcResponse) => {
                if (!res.isSuccess) {
                    res.payload = this.$rebuildError(res.payload)
                    if (res.payload instanceof InternalErrorException) {
                        return Promise.reject(res.payload) as Promise<any>
                    }
                }
                return res
            })
            .catch((err: StatusCodeError) => {
                let ex
                if (err.statusCode === 500) {
                    ex = new InternalErrorException(err.message)
                }
                else {
                    ex = new MinorException(err.message)
                    ex.details = err
                }
                return Promise.reject(ex)
            })
    }

    /**
     * @see IRpcCaller.callImpatient
     */
    public callImpatient(options: rpc.RpcCallerOptions): Promise<void> {
        return new Promise((_, reject) => {
            this.call(options).catch(reject)
        })
    }
}
