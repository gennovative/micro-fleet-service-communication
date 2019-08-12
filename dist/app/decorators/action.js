"use strict";
/// <reference types="reflect-metadata" />
Object.defineProperty(exports, "__esModule", { value: true });
const MetaData_1 = require("../constants/MetaData");
/**
 * Used to decorate action function of REST controller class.
 * @param {string} method Case-insensitive HTTP verb supported by Express
     *         (see full list at https://expressjs.com/en/4x/api.html#routing-methods)
 * @param {string} name Segment of URL pointing to this action.
 *         If not specified, it is default to be the action's function name.
 */
function action(name, isRawDest = false) {
    return function (proto, funcName) {
        if (!name) {
            name = funcName;
        }
        const metadata = { name, isRawDest };
        Reflect.defineMetadata(MetaData_1.MetaData.ACTION, metadata, proto.constructor, funcName);
        return proto;
    };
}
exports.action = action;
//# sourceMappingURL=action.js.map