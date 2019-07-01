import { Guard, IModelAutoMapper } from '@micro-fleet/common'

import { decorateParam } from './param-decor-base'


export type PayloadModelOptions = {
    /**
     * Result object will be instance of this class.
     */
    ModelClass?: Newable,

    /**
     * Whether this request contains all properties of model class,
     * or just some of them.
     * Default: false
     */
    isPartial?: boolean,

    /**
     * Function to extract model object from payload.
     * As default, model object is the payload itself.
     */
    extractFn?: (payload: any) => any,
}

function translateModel(payload: any, opts: PayloadModelOptions): any {
    if (!payload) { return null }

    const { ModelClass, isPartial, extractFn } = opts
    const rawModel = Boolean(extractFn) ? extractFn(payload) : payload

    if (typeof rawModel === 'object' && ModelClass) {
        Guard.assertArgDefined(`${ModelClass}.translator`, ModelClass['translator'])
        const translator: IModelAutoMapper<any> = ModelClass['translator']
        const func: Function = (!!isPartial) ? translator.partial : translator.whole
        return func.call(translator, rawModel)
    }
    return rawModel
}

export type PayloadDecorator = (options?: Newable | PayloadModelOptions) => Function

/**
 * For action parameter decoration.
 * Resolves the parameter's value with the request payload.
 * @param {class | PayloadModelOptions} options A class or options of how to
 *      translate the payload into instance of specified class.
 */
export function payloadDecor(options?: Newable | PayloadModelOptions): Function {
    return function (proto: any, method: string, paramIndex: number): Function {
        decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => {
                if (!options) {
                    return params.payload
                }
                const opts = (typeof options === 'object')
                    ? options // is PayloadModelOptions
                    : <PayloadModelOptions>{ // is class reference
                        ModelClass: options,
                    }
                return translateModel(params.payload, opts)
            },
        })
        return proto
    }
}
