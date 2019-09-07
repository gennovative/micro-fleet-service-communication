"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const param_decor_base_1 = require("./param-decor-base");
/**
 * For action parameter decoration.
 * Resolves the parameter's value with the RPC request instance.
 */
function rpcRequest() {
    return function (proto, method, paramIndex) {
        param_decor_base_1.decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => params.rpcRequest,
        });
        return proto;
    };
}
exports.rpcRequest = rpcRequest;
//# sourceMappingURL=rpcRequest.js.map