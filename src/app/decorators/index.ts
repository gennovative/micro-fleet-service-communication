/* istanbul ignore next */
if (!Reflect || typeof Reflect['hasOwnMetadata'] !== 'function') {
    require('reflect-metadata')
}

import { directController, mediateController, ControllerDecorator } from './controller'
import { action, ActionDecorator} from './action'
import { filter, FilterDecorator } from './filter'
import { rawMessage, RawMessageDecorator } from './rawMessage'
import { resolveFn, ResolveFnDecorator } from './resolveFn'
import { rejectFn, RejectFnDecorator } from './rejectFn'
import { rpcRequest, RpcRequestDecorator } from './rpcRequest'
import { payloadDecor, PayloadDecorator } from './payload'


export type Decorators = {
    /**
     * Used to decorate action function of REST controller class.
     * @param {string} name Action name, or full destination address if `isRawDest` is true
     * @param {boolean} isRawDest If true, use `name` as raw destination address.
     */
    action: ActionDecorator,

    /**
     * Used to decorate controller class for direct RPC handler.
     * @param {string} moduleName Module name, must be URL-safe
     *         If '_' is given, it is extract from controller class name: {path}Controller.
     *         If not specified, it is default to be empty string.
     */
    directController: ControllerDecorator,

    /**
     * Used to decorate controller class for direct RPC handler.
     * @param {string} moduleName Module name, must be URL-safe
     *         If '_' is given, it is extract from controller class name: {path}Controller.
     *         If not specified, it is default to be empty string.
     */
    mediateController: ControllerDecorator,

    /**
     * Used to add filter to controller class and controller action.
     * @param {class} FilterClass Filter class.
     * @param {ExpressionStatement} filterFunc An arrow function that returns filter's function.
     *         This array function won't be executed, but is used to extract filter function name.
     * @param {number} priority A number from 0 to 10, filters with greater priority run before ones with less priority.
     */
    filter: FilterDecorator,

    // model: ModelDecorator,

    /**
     * For action parameter decoration.
     * Resolves the parameter's value with the raw request message,
     * which is either HTTP request (direct RPC) or Message broker message (mediate RPC).
     */
    rawMessage: RawMessageDecorator,

    /**
     * For action parameter decoration.
     * Resolves the parameter's value with the Promise `resolve` function that
     *      responds and ends the request.
     */
    resolveFn: ResolveFnDecorator,

    /**
     * For action parameter decoration.
     * Resolves the parameter's value with the Promise `reject` function that
     *      responds and ends the request.
     */
    rejectFn: RejectFnDecorator,

    /**
     * For action parameter decoration.
     * Resolves the parameter's value with the request payload.
     * @param {class | PayloadModelOptions} options A class or options of how to
     *      translate the payload into instance of specified class.
     */
    payload: PayloadDecorator,

    /**
     * For action parameter decoration.
     * Resolves the parameter's value with the RPC request instance.
     */
    rpcRequest: RpcRequestDecorator,
}

export const decorators: Decorators = {
    action: action,
    directController,
    mediateController,
    filter,
    // model,
    rawMessage,
    resolveFn,
    rejectFn,
    rpcRequest,
    payload: payloadDecor,
}
