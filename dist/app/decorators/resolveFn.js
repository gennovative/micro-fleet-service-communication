"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const param_decor_base_1 = require("./param-decor-base");
exports.RESOLVE_INJECTED = Symbol('RESOLVE_INJECTED');
/**
 * For action parameter decoration.
 * Resolves the parameter's value with the Promise `resolve` function that
 *      responds and ends the request.
 */
function resolveFn() {
    return function (proto, method, paramIndex) {
        param_decor_base_1.decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => {
                params[exports.RESOLVE_INJECTED] = true;
                return params.resolve;
            },
        });
        return proto;
    };
}
exports.resolveFn = resolveFn;
//# sourceMappingURL=resolveFn.js.map