"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@micro-fleet/common");
const param_decor_base_1 = require("./param-decor-base");
/**
 * This is the meta key that TypeScript automatically decorates.
 */
const PARAM_TYPE_META = 'design:paramtypes';
/**
 * For action parameter decoration.
 * Resolves the parameter's value with the request payload.
 * @param {class | PayloadDecoratorOptions} options A class or options of how to
 *      translate the payload into instance of specified class.
 */
function payload(opts = {}) {
    return function (proto, method, paramIndex) {
        if (typeof opts === 'function') {
            opts = {
                ItemClass: opts,
            };
        }
        let parseFn;
        param_decor_base_1.decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => {
                parseFn = parseFn || modelParserFactory(proto, method, paramIndex, opts);
                return translateModel(params.payload, opts, parseFn);
            },
        });
    };
}
exports.payload = payload;
function translateModel(payloadObj, opts, parse) {
    if (!payloadObj) {
        return null;
    }
    const { extractFn } = opts;
    const rawModel = Boolean(extractFn) ? extractFn(payloadObj) : payloadObj;
    return parse(rawModel);
}
/**
 * Selects a function to parse payload to model object.
 */
function modelParserFactory(proto, method, paramIndex, opts) {
    const ModelClass = getParamType(proto, method, paramIndex);
    const { ItemClass, isPartial } = opts;
    const translateOpt = (opts.enableValidation != null)
        ? { enableValidation: opts.enableValidation }
        : null;
    const errPrefix = `In ${proto.constructor.name}.${method}:`;
    if (ModelClass === Array) {
        return toArray(ItemClass, isPartial, translateOpt, errPrefix);
    }
    else if (typeof ModelClass['getTranslator'] === 'function') {
        return translate(ModelClass, isPartial, translateOpt, errPrefix);
    }
    else if (ItemClass) {
        return translate(ItemClass, isPartial, translateOpt, errPrefix);
    }
    return (rawModel) => rawModel;
}
function toArray(ItemClass, isPartial, translateOpt, errPrefix) {
    return function (rawModel) {
        if (Array.isArray(rawModel) && ItemClass) {
            return rawModel.map(translate(ItemClass, isPartial, translateOpt, errPrefix));
        }
        else if (ItemClass) {
            // Wrap single value of one-item array
            return [translate(ItemClass, isPartial, translateOpt, errPrefix)(rawModel)];
        }
        return [rawModel];
    };
}
function translate(Class, isPartial, translateOpt, errPrefix) {
    return function (rawModel) {
        common_1.Guard.assertIsDefined(Class.getTranslator, `${errPrefix} ItemClass must be translatable (by either extending class Translatable`
            + ' or decorated with @translatable())');
        const translator = Class.getTranslator();
        const func = Boolean(isPartial) ? translator.partial : translator.whole;
        return func.call(translator, rawModel, translateOpt);
    };
}
function getParamType(proto, method, paramIndex) {
    // Expected: ===========================v
    // __metadata("design:paramtypes", [Number, String, Object]),
    const paramTypes = Reflect.getOwnMetadata(PARAM_TYPE_META, proto, method) || [];
    return paramTypes[paramIndex];
}
//# sourceMappingURL=payload.js.map