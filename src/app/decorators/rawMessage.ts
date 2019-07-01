import { decorateParam } from './param-decor-base'


export type RawMessageDecorator = () => Function

/**
 * For action parameter decoration.
 * Resolves the parameter's value with the raw request message,
 * which is either HTTP request (direct RPC) or Message broker message (mediate RPC).
 */
export function rawMessage(): Function {
    return function (proto: any, method: string, paramIndex: number): Function {
        decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => params.rawMessage,
        })
        return proto
    }
}
