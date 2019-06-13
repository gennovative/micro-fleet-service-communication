/// <reference types="reflect-metadata" />

import { MetaData } from '../constants/MetaData'


export type ActionDecorator = (name?: string) => Function

/**
 * Used to decorate action function of REST controller class.
 * @param {string} method Case-insensitive HTTP verb supported by Express
     *         (see full list at https://expressjs.com/en/4x/api.html#routing-methods)
 * @param {string} name Segment of URL pointing to this action.
 *         If not specified, it is default to be the action's function name.
 */
export function action(name?: string): Function {
    return function (proto: any, funcName: string): Function {
        if (!name) {
            name = funcName
        } else if (name.length > 1) {
            if (name.startsWith('/')) {
                // Remove heading slash
                name = name.substr(1)
            }
            if (name.endsWith('/')) {
                // Remove trailing slash
                name = name.substr(0, name.length - 1)
            }
        }

        Reflect.defineMetadata(MetaData.ACTION, [ name ], proto.constructor, funcName)
        return proto
    }
}
