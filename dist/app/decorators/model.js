"use strict";
// import * as joi from 'joi'
// import { Guard, ModelAutoMapper, MinorException } from '@micro-fleet/common'
// import { ModelFilterOptions } from '../filters/ModelFilter'
// import { Request } from '../interfaces'
// import { decorateParam } from './param-decor-base'
// import { extractTenantId } from './tenantId'
// export type ModelDecorator = (opts: Newable | ModelFilterOptions) => Function
// /*
//  * Attempts to translate request body to desired model class.
//  * @deprecated
//  */
// // function modelAction(opts: ModelFilterOptions): Function {
// //     return function (TargetClass: Newable, key: string): Function {
// //         TargetClass = addFilterToTarget<ModelFilter>(ModelFilter, TargetClass, key, FilterPriority.MEDIUM, opts) as Newable
// //         return TargetClass
// //     }
// // }
// export type ModelDecoratorOptions = {
//     /**
//      * Result object will be instance of this class.
//      */
//     ModelClass?: Newable
//     /**
//      * Whether this request contains just some properties of model class.
//      * Default: false (request contains all props)
//      */
//     isPartial?: boolean
//     /**
//      * Function to extract model object from request body.
//      * As default, model object is extracted from `request.body.model`.
//      */
//     modelPropFn?: <T extends object = object>(request: Request<T>) => any
//     /**
//      * Custom validation rule for arbitrary object.
//      */
//     customValidationRule?: joi.SchemaMap,
//     /**
//      * If true, will attempt to resolve tenantId from request.params
//      * then attach to the result object.
//      */
//     hasTenantId?: boolean
// }
// export async function extractModel(req: Request, options: ModelFilterOptions): Promise<object> {
//     const { ModelClass, isPartial, modelPropFn, hasTenantId } = options
//     Guard.assertArgDefined('ModelClass', ModelClass)
//     Guard.assertArgDefined(`${ModelClass}.translator`, ModelClass['translator'])
//     const translator: ModelAutoMapper<any> = ModelClass['translator']
//     const func: Function = !translator
//         ? (m: any) => m // Noop function
//         : Boolean(isPartial)
//             ? translator.partial
//             : translator.whole
//     let rawModel: object
//     if (req.body && req.body.model) {
//         rawModel = req.body.model
//     }
//     else if (typeof modelPropFn === 'function') {
//         rawModel = modelPropFn(req)
//     }
//     else {
//         throw new MinorException('Request body must have property "model".
// Otherwise, you must provide "modelPropFn" in decorator option.')
//     }
//     if (hasTenantId && typeof rawModel === 'object') {
//         (await extractTenantId(req))
//             .map(val => rawModel['tenantId'] = val)
//     }
//     const resultModel = func.call(translator, rawModel)
//     return resultModel
// }
// /**
//  * For action parameter decoration.
//  * Attempts to translate request body to desired model class,
//  * then attaches to the parameter's value.
//  * @param opts Can be the Model Class or option object.
//  */
// export function model(opts: Newable | ModelFilterOptions): Function {
//     return function (proto: any, method: string, paramIndex: number): Function {
//         if (typeof opts === 'function') {
//             opts = {
//                 ModelClass: opts,
//             }
//         }
//         decorateParam({
//             TargetClass: proto.constructor,
//             method,
//             paramIndex,
//             resolverFn: (request) => extractModel(request, opts as ModelFilterOptions),
//         })
//         return proto
//     }
// }
//# sourceMappingURL=model.js.map