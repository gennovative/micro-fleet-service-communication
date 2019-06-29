"use strict";
/// <reference types="reflect-metadata" />
Object.defineProperty(exports, "__esModule", { value: true });
const MetaData_1 = require("../constants/MetaData");
/**
 * Stored the `resolverFn` for later use to resolve value for
 * param `paramIndex` of the `method` of `TargetClass`.
 */
function decorateParam(opts) {
    const args = [MetaData_1.MetaData.PARAM_DECOR, opts.TargetClass, opts.method];
    let paramDesc;
    if (Reflect.hasOwnMetadata.apply(Reflect, args)) {
        paramDesc = Reflect.getOwnMetadata.apply(Reflect, args);
    }
    else {
        paramDesc = [];
    }
    paramDesc[opts.paramIndex] = opts.resolverFn;
    Reflect.defineMetadata(MetaData_1.MetaData.PARAM_DECOR, paramDesc, opts.TargetClass, opts.method);
}
exports.decorateParam = decorateParam;
//# sourceMappingURL=param-decor-base.js.map