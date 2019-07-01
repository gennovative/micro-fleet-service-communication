import { decorateParam } from './param-decor-base'


export type RpcRequestDecorator = () => Function

/**
 * For action parameter decoration.
 * Resolves the parameter's value with the RPC request instance.
 */
export function rpcRequest(): Function {
    return function (proto: any, method: string, paramIndex: number): Function {
        decorateParam({
            TargetClass: proto.constructor,
            method,
            paramIndex,
            resolverFn: (params) => params.rpcRequest,
        })
        return proto
    }
}
