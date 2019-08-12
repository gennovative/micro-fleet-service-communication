/// <reference types="reflect-metadata" />

import { MetaData } from '../constants/MetaData'


export type ActionMetadata = { name: string, isRawDest: boolean }

/**
 * @param {string} name Action name, or full destination address if `isRawDest` is true
 * @param {boolean} isRawDest If true, use `name` as raw destination address.
 */
export type ActionDecorator = (name?: string, isRawDest?: boolean) => Function

/**
 * Used to decorate action function of REST controller class.
 * @param {string} method Case-insensitive HTTP verb supported by Express
     *         (see full list at https://expressjs.com/en/4x/api.html#routing-methods)
 * @param {string} name Segment of URL pointing to this action.
 *         If not specified, it is default to be the action's function name.
 */
export function action(name?: string, isRawDest: boolean = false): Function {
    return function (proto: any, funcName: string): Function {
        if (!name) {
            name = funcName
        }

        const metadata: ActionMetadata = { name, isRawDest }
        Reflect.defineMetadata(MetaData.ACTION, metadata, proto.constructor, funcName)
        return proto
    }
}
