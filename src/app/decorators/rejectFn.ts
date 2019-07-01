import { decorateParam } from './param-decor-base'


export const REJECT_INJECTED = Symbol('REJECT_INJECTED')

export type RejectFnDecorator = () => Function

/**
 * For action parameter decoration.
 * Resolves the parameter's value with the Promise `reject` function that
 *      responds and ends the request.
 */
export function rejectFn(): Function {
    return function (proto: any, method: string, paramIndex: number): Function {
        decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => {
                params[REJECT_INJECTED] = true
                return params.reject
            },
        })
        return proto
    }
}
