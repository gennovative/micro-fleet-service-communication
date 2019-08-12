import { IDependencyContainer, Guard, IServiceAddOn, serviceContext } from '@micro-fleet/common'

import { Types as T } from './constants/Types'
import { IDirectRpcHandler, ExpressRpcHandler } from './direct/DirectRpcHandler'
import { DefaultDirectRpcHandlerAddOn } from './direct/DefaultDirectRpcHandlerAddOn'
import { DefaultMediateRpcHandlerAddOn } from './mediate/DefaultMediateRpcHandlerAddOn'
import { IMediateRpcHandler, MessageBrokerRpcHandler } from './mediate/MediateRpcHandler'
import { MessageBrokerAddOn } from './MessageBrokerAddOn'
import { TopicMessageBrokerConnector } from './MessageBrokerConnector'
import { IDirectRpcCaller, HttpRpcCaller } from './direct/DirectRpcCaller'
import { IMediateRpcCaller, MessageBrokerRpcCaller } from './mediate/MediateRpcCaller'
import { MediateRpcHandlerAddOnBase } from './mediate/MediateRpcHandlerAddOnBase'
import { IRpcCaller } from './RpcCommon'


export function registerMessageBrokerAddOn(): IServiceAddOn {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer
    if (!depCon.isBound(T.MSG_BROKER_CONNECTOR)) {
        depCon.bind(T.MSG_BROKER_CONNECTOR, TopicMessageBrokerConnector).asSingleton()
    }
    if (!depCon.isBound(T.BROKER_ADDON)) {
        depCon.bind(T.BROKER_ADDON, MessageBrokerAddOn).asSingleton()
    }
    return depCon.resolve<IServiceAddOn>(T.BROKER_ADDON)
}

export function registerDirectHandlerAddOn(): IServiceAddOn {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer
    if (!depCon.isBound(T.DIRECT_RPC_HANDLER)) {
        depCon.bind<IDirectRpcHandler>(T.DIRECT_RPC_HANDLER, ExpressRpcHandler).asSingleton()
    }
    if (!depCon.isBound(T.DIRECT_RPC_HANDLER_ADDON)) {
        depCon.bind<IServiceAddOn>(T.DIRECT_RPC_HANDLER_ADDON, DefaultDirectRpcHandlerAddOn).asSingleton()
    }
    return depCon.resolve<IServiceAddOn>(T.DIRECT_RPC_HANDLER_ADDON)
}

export function registerDirectCaller(): void {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer
    if (!depCon.isBound(T.DIRECT_RPC_CALLER)) {
        depCon.bind<IDirectRpcCaller>(T.DIRECT_RPC_CALLER, HttpRpcCaller).asSingleton()
        depCon.bind<IRpcCaller>(T.RPC_CALLER, HttpRpcCaller).asSingleton()
    }
}

export function registerMediateHandlerAddOn(): MediateRpcHandlerAddOnBase {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer
    Guard.assertIsTruthy(
        depCon.isBound(T.BROKER_ADDON),
        'MessageBrokerAddOn must be registered before this one',
    )
    if (!depCon.isBound(T.MEDIATE_RPC_HANDLER)) {
        depCon.bind<IMediateRpcHandler>(T.MEDIATE_RPC_HANDLER, MessageBrokerRpcHandler).asSingleton()
    }
    if (!depCon.isBound(T.MEDIATE_RPC_HANDLER_ADDON)) {
        depCon.bind(T.MEDIATE_RPC_HANDLER_ADDON, DefaultMediateRpcHandlerAddOn).asSingleton()
    }
    return depCon.resolve<MediateRpcHandlerAddOnBase>(T.MEDIATE_RPC_HANDLER_ADDON)
}

export function registerMediateCaller(): void {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer
    Guard.assertIsTruthy(
        depCon.isBound(T.BROKER_ADDON),
        'MessageBrokerAddOn must be registered before this one',
    )
    if (!depCon.isBound(T.MEDIATE_RPC_CALLER)) {
        depCon.bind<IMediateRpcCaller>(T.MEDIATE_RPC_CALLER, MessageBrokerRpcCaller).asSingleton()
        depCon.bind<IRpcCaller>(T.RPC_CALLER, MessageBrokerRpcCaller).asSingleton()
    }
}
