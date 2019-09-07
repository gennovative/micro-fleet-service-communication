/// <reference types="reflect-metadata" />

import { MetaData } from '../constants/MetaData'
import { RpcHandlerParams } from '../RpcCommon'
import { Newable } from '@micro-fleet/common'


export type ParseFunction = (input: string) => any

export type DecorateParamOptions = {
    /**
     * The class that has the method to which the decorated parameter belongs.
     */
    TargetClass: Newable,

    /**
     * The function name whose signature contains the decorated parameter.
     */
    method: string | symbol,

    /**
     * Position of the decorated parameter in function signature.
     */
    paramIndex: number,

    /**
     * The function to figure out the value for the decorated parameter
     */
    resolverFn: (params: RpcHandlerParams) => Promise<any> | any,
}

export type ParamDecorDescriptor = Function[]

/**
 * Stored the `resolverFn` for later use to resolve value for
 * param `paramIndex` of the `method` of `TargetClass`.
 */
export function decorateParam(opts: DecorateParamOptions) {
    const args: any = [MetaData.PARAM_DECOR, opts.TargetClass, opts.method]
    let paramDesc: ParamDecorDescriptor
    if (Reflect.hasOwnMetadata.apply(Reflect, args)) {
        paramDesc = Reflect.getOwnMetadata.apply(Reflect, args)
    } else {
        paramDesc = []
    }
    paramDesc[opts.paramIndex] = opts.resolverFn
    Reflect.defineMetadata(MetaData.PARAM_DECOR, paramDesc, opts.TargetClass, opts.method)
}
