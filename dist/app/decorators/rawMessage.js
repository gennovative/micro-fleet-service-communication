"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const param_decor_base_1 = require("./param-decor-base");
/**
 * For action parameter decoration.
 * Resolves the parameter's value with the raw request message,
 * which is either HTTP request (direct RPC) or Message broker message (mediate RPC).
 */
function rawMessage() {
    return function (proto, method, paramIndex) {
        param_decor_base_1.decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => params.rawMessage,
        });
        return proto;
    };
}
exports.rawMessage = rawMessage;
//# sourceMappingURL=rawMessage.js.map