import { Guard, IModelAutoMapper, ITranslatable } from '@micro-fleet/common'

import { decorateParam, ParseFunction } from './param-decor-base'


/**
 * This is the meta key that TypeScript automatically decorates.
 */
const PARAM_TYPE_META = 'design:paramtypes'

export type PayloadDecoratorOptions = {

    /**
     * Function to extract model object from payload.
     * As default, model object is the payload itself.
     */
    extractFn?(payload: any): any;

    /**
     * Turns on or off model validation before translating.
     * Default `false`.
     */
    enableValidation?: boolean,

    /**
     * Whether this request contains all properties of model class,
     * or just some of them.
     * Default: false
     */
    isPartial?: boolean,

    /**
     * If the expected model is an array, the array item type must
     * be specified here.
     */
    ItemClass?: ITranslatable,
}

export type PayloadDecorator = (options?: ITranslatable | PayloadDecoratorOptions) => Function

/**
 * For action parameter decoration.
 * Resolves the parameter's value with the request payload.
 * @param {class | PayloadDecoratorOptions} options A class or options of how to
 *      translate the payload into instance of specified class.
 */
export function payload(opts: ITranslatable | PayloadDecoratorOptions = {}): ParameterDecorator {
    return function (proto: any, method: string | symbol, paramIndex: number): void {
        if (typeof opts === 'function') {
            opts = {
                ItemClass: opts,
            }
        }

        let parseFn: ParseFunction
        decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => {
                parseFn = parseFn || modelParserFactory(proto, method, paramIndex, opts as PayloadDecoratorOptions)
                return translateModel(params.payload, opts as PayloadDecoratorOptions, parseFn)
            },
        })
    }
}

function translateModel(payloadObj: any, opts: PayloadDecoratorOptions, parse: ParseFunction): any {
    if (!payloadObj) { return null }
    const { extractFn } = opts
    const rawModel = Boolean(extractFn) ? extractFn(payloadObj) : payloadObj
    return parse(rawModel)
}


/**
 * Selects a function to parse payload to model object.
 */
function modelParserFactory(proto: any, method: string | symbol, paramIndex: number, opts: PayloadDecoratorOptions): ParseFunction {
    const ModelClass = getParamType(proto, method, paramIndex)
    const { ItemClass, isPartial } = opts
    const translateOpt = (opts.enableValidation != null)
        ? { enableValidation: opts.enableValidation}
        : null
    const errPrefix = `In ${proto.constructor.name}.${method as string}:`

    if (ModelClass === Array) {
        return toArray(ItemClass, isPartial, translateOpt, errPrefix)
    }
    else if (typeof ModelClass['getTranslator'] === 'function') {
        return translate(ModelClass as any, isPartial, translateOpt, errPrefix)
    }
    else if (ItemClass) {
        return translate(ItemClass, isPartial, translateOpt, errPrefix)
    }
    return (rawModel: any) => rawModel
}

function toArray(ItemClass: ITranslatable, isPartial: boolean, translateOpt: any, errPrefix: string): ParseFunction {
    return function (rawModel: any) {
        if (Array.isArray(rawModel) && ItemClass) {
            return rawModel.map(translate(ItemClass, isPartial, translateOpt, errPrefix))
        }
        else if (ItemClass) {
            // Wrap single value of one-item array
            return [translate(ItemClass, isPartial, translateOpt, errPrefix)(rawModel)]
        }
        return [rawModel]
    }
}

function translate(Class: ITranslatable, isPartial: boolean, translateOpt: any, errPrefix: string): ParseFunction {
    return function (rawModel: any) {
        Guard.assertIsDefined(Class.getTranslator, `${errPrefix} ItemClass must be translatable (by either extending class Translatable`
            + ' or decorated with @translatable())')
        const translator: IModelAutoMapper<any> = Class.getTranslator()
        const func: Function = Boolean(isPartial) ? translator.partial : translator.whole
        return func.call(translator, rawModel, translateOpt)
    }
}

function getParamType(proto: any, method: string | symbol, paramIndex: number): any {
    // Expected: ===========================v
    // __metadata("design:paramtypes", [Number, String, Object]),
    const paramTypes = Reflect.getOwnMetadata(PARAM_TYPE_META, proto, method) || []
    return paramTypes[paramIndex]
}
