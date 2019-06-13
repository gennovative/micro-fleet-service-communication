"use strict";
/// <reference types="reflect-metadata" />
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@micro-fleet/common");
const MetaData_1 = require("../constants/MetaData");
/**
 * Used to decorate controller class for direct RPC handler.
 * @param {string} moduleName Module name, must be URL-safe
 *         If '_' is given, it is extract from controller class name: {path}Controller.
 *         If not specified, it is default to be empty string.
 */
function directController(moduleName) {
    return createProcessor(MetaData_1.MetaData.CONTROLLER_DIRECT, moduleName);
}
exports.directController = directController;
/**
 * Used to decorate controller class for mediate RPC handler.
 * @param {string} moduleName Module name, must be URL-safe
 *         If '_' is given, it is extract from controller class name: {path}Controller.
 *         If not specified, it is default to be empty string.
 */
function mediateController(moduleName) {
    return createProcessor(MetaData_1.MetaData.CONTROLLER_MEDIATE, moduleName);
}
exports.mediateController = mediateController;
function createProcessor(metadata, moduleName) {
    return function (targetClass) {
        if (Reflect.hasOwnMetadata(metadata, targetClass)) {
            throw new common_1.CriticalException('Duplicate controller decorator');
        }
        common_1.decorate(common_1.injectable(), targetClass);
        if (!moduleName) {
            // Extract path from controller name.
            // Only if controller name is in format {xxx}Controller.
            moduleName = targetClass.name.match(/(.+)Controller$/)[1];
            moduleName = moduleName[0].toLowerCase() + moduleName.substring(1); // to camel case
            common_1.Guard.assertIsDefined(moduleName, 'Cannot automatically extract path, make sure controller name has "Controller" suffix!');
        }
        else if (moduleName.length > 1) {
            if (moduleName.startsWith('/')) {
                // Remove heading slash
                moduleName = moduleName.substr(1);
            }
            if (moduleName.endsWith('/')) {
                // Remove trailing slash
                moduleName = moduleName.substr(0, moduleName.length - 1);
            }
        }
        Reflect.defineMetadata(metadata, [moduleName], targetClass);
        return targetClass;
    };
}
//# sourceMappingURL=controller.js.map