"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const param_decor_base_1 = require("./param-decor-base");
exports.REJECT_INJECTED = Symbol('REJECT_INJECTED');
/**
 * For action parameter decoration.
 * Resolves the parameter's value with the Promise `reject` function that
 *      responds and ends the request.
 */
function rejectFn() {
    return function (proto, method, paramIndex) {
        param_decor_base_1.decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => {
                params[exports.REJECT_INJECTED] = true;
                return params.reject;
            },
        });
        return proto;
    };
}
exports.rejectFn = rejectFn;
//# sourceMappingURL=rejectFn.js.map