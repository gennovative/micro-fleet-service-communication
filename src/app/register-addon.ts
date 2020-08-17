import { IDependencyContainer, Guard, IServiceAddOn, serviceContext } from '@micro-fleet/common'

import { Types as T } from './constants/Types'
import { IDirectRpcHandler, ExpressRpcHandler } from './direct/DirectRpcHandler'
import { DefaultDirectRpcHandlerAddOn } from './direct/DefaultDirectRpcHandlerAddOn'
import { DefaultMediateRpcHandlerAddOn } from './mediate/DefaultMediateRpcHandlerAddOn'
import { IMediateRpcHandler, MessageBrokerRpcHandler } from './mediate/MediateRpcHandler'
import { MessageBrokerProviderAddOn } from './MessageBrokerProviderAddOn'
import { IDirectRpcCaller, HttpRpcCaller } from './direct/DirectRpcCaller'
import { IMediateRpcCaller, MessageBrokerRpcCaller } from './mediate/MediateRpcCaller'
import { MediateRpcHandlerAddOnBase } from './mediate/MediateRpcHandlerAddOnBase'
import { IDENTIFIER as MSG_BROKER_CONNECTOR, TopicMessageBrokerConnector,
    MessageBrokerConnectionOptions } from './MessageBrokerConnector'
import { IRpcCaller } from './RpcCommon'


export function registerMessageBrokerAddOn(): IServiceAddOn {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer

    if (!depCon.isBound(MSG_BROKER_CONNECTOR)) {
        depCon.bindFactory(MSG_BROKER_CONNECTOR, () => {
            return (options: MessageBrokerConnectionOptions) => new TopicMessageBrokerConnector(options)
        })
    }

    if (!depCon.isBound(T.BROKER_ADDON)) {
        depCon.bindConstructor(T.BROKER_ADDON, MessageBrokerProviderAddOn).asSingleton()
    }
    const addon = depCon.resolve<IServiceAddOn>(T.BROKER_ADDON)
    if (!depCon.isBound(T.MSG_BROKER_CONNECTOR_PROVIDER)) {
        depCon.bindConstant(T.MSG_BROKER_CONNECTOR_PROVIDER, addon)
    }
    return addon
}

export function registerDirectHandlerAddOn(): IServiceAddOn {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer
    if (!depCon.isBound(T.DIRECT_RPC_HANDLER)) {
        depCon.bindConstructor<IDirectRpcHandler>(T.DIRECT_RPC_HANDLER, ExpressRpcHandler).asSingleton()
    }
    if (!depCon.isBound(T.DIRECT_RPC_HANDLER_ADDON)) {
        depCon.bindConstructor<IServiceAddOn>(T.DIRECT_RPC_HANDLER_ADDON, DefaultDirectRpcHandlerAddOn).asSingleton()
    }
    return depCon.resolve<IServiceAddOn>(T.DIRECT_RPC_HANDLER_ADDON)
}

export function registerDirectCaller(): void {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer
    if (!depCon.isBound(T.DIRECT_RPC_CALLER)) {
        depCon.bindConstructor<IDirectRpcCaller>(T.DIRECT_RPC_CALLER, HttpRpcCaller).asSingleton()
        depCon.bindConstructor<IRpcCaller>(T.RPC_CALLER, HttpRpcCaller).asSingleton()
    }
}

export function registerMediateHandlerAddOn(): IServiceAddOn {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer
    Guard.assertIsTruthy(
        depCon.isBound(T.BROKER_ADDON),
        'MessageBrokerAddOn must be registered before this one',
    )
    if (!depCon.isBound(T.MEDIATE_RPC_HANDLER)) {
        depCon.bindConstructor<IMediateRpcHandler>(T.MEDIATE_RPC_HANDLER, MessageBrokerRpcHandler).asSingleton()
    }
    if (!depCon.isBound(T.MEDIATE_RPC_HANDLER_ADDON)) {
        depCon.bindConstructor(T.MEDIATE_RPC_HANDLER_ADDON, DefaultMediateRpcHandlerAddOn).asSingleton()
    }
    return depCon.resolve<IServiceAddOn>(T.MEDIATE_RPC_HANDLER_ADDON)
}

export function registerMediateCaller(): void {
    const depCon: IDependencyContainer = serviceContext.dependencyContainer
    Guard.assertIsTruthy(
        depCon.isBound(T.BROKER_ADDON),
        'MessageBrokerAddOn must be registered before this one',
    )
    if (!depCon.isBound(T.MEDIATE_RPC_CALLER)) {
        depCon.bindConstructor<IMediateRpcCaller>(T.MEDIATE_RPC_CALLER, MessageBrokerRpcCaller).asSingleton()
        depCon.bindConstructor<IRpcCaller>(T.RPC_CALLER, MessageBrokerRpcCaller).asSingleton()
    }
}
