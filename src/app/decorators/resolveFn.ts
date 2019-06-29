import { decorateParam } from './param-decor-base'


export const RESOLVE_INJECTED = Symbol('RESOLVE_INJECTED')

export type ResolveFnDecorator = () => Function

/**
 * For action parameter decoration.
 * Resolves the parameter's value with the Promise `resolve` function that
 *      responds and ends the request.
 */
export function resolveFn(): Function {
    return function (proto: any, method: string, paramIndex: number): Function {
        decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: ({resolve}) => {
                resolve[RESOLVE_INJECTED] = true
                return resolve
            },
        })
        return proto
    }
}
