/// <reference types="reflect-metadata" />

import { CriticalException, Guard, decorators as d } from '@micro-fleet/common'

import { METADATA_KEY } from 'inversify'

import { MetaData } from '../constants/MetaData'


/**
 * Used to decorate controller class for direct RPC handler.
 * @param {string} moduleName Module name, must be URL-safe
 *         If '_' is given, it is extract from controller class name: {path}Controller.
 *         If not specified, it is default to be empty string.
 */
export function directController(moduleName?: string): Function {
    return createProcessor(MetaData.CONTROLLER_DIRECT, moduleName)
}

/**
 * Used to decorate controller class for mediate RPC handler.
 * @param {string} moduleName Module name, must be URL-safe
 *         If '_' is given, it is extract from controller class name: {path}Controller.
 *         If not specified, it is default to be empty string.
 */
export function mediateController(moduleName?: string): Function {
    return createProcessor(MetaData.CONTROLLER_MEDIATE, moduleName)
}


function createProcessor(metadata: string, moduleName?: string) {
    return function (TargetClass: Function): Function {
        if (Reflect.hasOwnMetadata(metadata, TargetClass)) {
            throw new CriticalException('Duplicate controller decorator')
        }

        notInjectable(TargetClass) && d.decorate(d.injectable(), TargetClass)

        if (!moduleName) {
            // Extract path from controller name.
            // Only if controller name is in format {xxx}Controller.
            moduleName = TargetClass.name.match(/(.+)Controller$/)[1]
            moduleName = moduleName[0].toLowerCase() + moduleName.substring(1) // to camel case
            Guard.assertIsDefined(moduleName, 'Cannot automatically extract path, make sure controller name has "Controller" suffix!')
        }

        Reflect.defineMetadata(metadata, [moduleName], TargetClass)

        return TargetClass
    }
}

function notInjectable(TargetClass: Function): boolean {
    return !Reflect.hasOwnMetadata(METADATA_KEY.PARAM_TYPES, TargetClass)

}
