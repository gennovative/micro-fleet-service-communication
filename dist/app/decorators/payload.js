"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@micro-fleet/common");
const param_decor_base_1 = require("./param-decor-base");
function translateModel(payload, opts) {
    if (!payload) {
        return null;
    }
    const { ModelClass, isPartial, extractFn } = opts;
    const enableValidation = opts.enableValidation != null ? opts.enableValidation : false;
    const rawModel = Boolean(extractFn) ? extractFn(payload) : payload;
    if (typeof rawModel === 'object' && ModelClass) {
        common_1.Guard.assertArgDefined(`${ModelClass}.translator`, ModelClass['translator']);
        const translator = ModelClass['translator'];
        const func = (!!isPartial) ? translator.partial : translator.whole;
        return func.call(translator, rawModel, { enableValidation });
    }
    return rawModel;
}
/**
 * For action parameter decoration.
 * Resolves the parameter's value with the request payload.
 * @param {class | PayloadModelOptions} options A class or options of how to
 *      translate the payload into instance of specified class.
 */
function payloadDecor(options) {
    return function (proto, method, paramIndex) {
        param_decor_base_1.decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => {
                if (!options) {
                    return params.payload;
                }
                const opts = (typeof options === 'object')
                    ? options // is PayloadModelOptions
                    : {
                        ModelClass: options,
                    };
                return translateModel(params.payload, opts);
            },
        });
        return proto;
    };
}
exports.payloadDecor = payloadDecor;
//# sourceMappingURL=payload.js.map