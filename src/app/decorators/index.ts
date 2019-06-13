/* istanbul ignore next */
if (!Reflect || typeof Reflect['hasOwnMetadata'] !== 'function') {
    require('reflect-metadata')
}

import { directController, mediateController, ControllerDecorator } from './controller'
import { model, ModelDecorator } from './model'
import { filter, FilterDecorator } from './filter'
import * as act from './action'


export type Decorators = {
    /**
     * Used to decorate action function of REST controller class.
     * @param {string} method Case-insensitive HTTP verb supported by Express
     *         (see full list at https://expressjs.com/en/4x/api.html#routing-methods)
     * @param {string} path Segment of URL pointing to this action.
     *         If not specified, it is default to be the action's function name.
     */
    action: act.ActionDecorator,

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

    model: ModelDecorator,
}

export const decorators: Decorators = {
    action: act.action,
    directController,
    mediateController,
    filter,
    model,
}
