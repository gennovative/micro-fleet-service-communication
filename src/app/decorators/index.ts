/* istanbul ignore next */
if (!Reflect || typeof Reflect['hasOwnMetadata'] !== 'function') {
    require('reflect-metadata')
}

import { directController, mediateController } from './controller'
import { action } from './action'
import { filter } from './filter'
import { rawMessage } from './rawMessage'
import { resolveFn } from './resolveFn'
import { rejectFn } from './rejectFn'
import { rpcRequest } from './rpcRequest'
import { payload } from './payload'


export type Decorators = {
    /**
     * Used to decorate action function of REST controller class.
     * @param {string} name Action name, or full destination address if `isRawDest` is true
     * @param {boolean} isRawDest If true, use `name` as raw destination address.
     */
    action: typeof action,

    /**
     * Used to decorate controller class for direct RPC handler.
     * @param {string} moduleName Module name, must be URL-safe
     *         If '_' is given, it is extract from controller class name: {path}Controller.
     *         If not specified, it is default to be empty string.
     */
    directController: typeof directController,

    /**
     * Used to decorate controller class for direct RPC handler.
     * @param {string} moduleName Module name, must be URL-safe
     *         If '_' is given, it is extract from controller class name: {path}Controller.
     *         If not specified, it is default to be empty string.
     */
    mediateController: typeof mediateController,

    /**
     * Used to add filter to controller class and controller action.
     * @param {class} FilterClass Filter class.
     * @param {ExpressionStatement} filterFunc An arrow function that returns filter's function.
     *         This array function won't be executed, but is used to extract filter function name.
     * @param {number} priority A number from 0 to 10, filters with greater priority run before ones with less priority.
     */
    filter: typeof filter,

    // model: ModelDecorator,

    /**
     * For action parameter decoration.
     * Resolves the parameter's value with the raw request message,
     * which is either HTTP request (direct RPC) or Message broker message (mediate RPC).
     */
    rawMessage: typeof rawMessage,

    /**
     * For action parameter decoration.
     * Resolves the parameter's value with the Promise `resolve` function that
     *      responds and ends the request.
     */
    resolveFn: typeof resolveFn,

    /**
     * For action parameter decoration.
     * Resolves the parameter's value with the Promise `reject` function that
     *      responds and ends the request.
     */
    rejectFn: typeof rejectFn,

    /**
     * For action parameter decoration.
     * Resolves the parameter's value with the request payload.
     * @param {class | PayloadModelOptions} options A class or options of how to
     *      translate the payload into instance of specified class.
     */
    payload: typeof payload,

    /**
     * For action parameter decoration.
     * Resolves the parameter's value with the RPC request instance.
     */
    rpcRequest: typeof rpcRequest,
}

export const decorators: Decorators = {
    action,
    directController,
    mediateController,
    filter,
    rawMessage,
    resolveFn,
    rejectFn,
    rpcRequest,
    payload,
}
