import { mock, instance, when, anything } from 'ts-mockito'
import { constants, IConfigurationProvider, Maybe } from '@micro-fleet/common'

import { IMediateRpcCaller, MessageBrokerRpcCaller,
    IMediateRpcHandler, MessageBrokerRpcHandler,
    IMessageBrokerConnector, TopicMessageBrokerConnector, IMessageBrokerConnectorProvider,
} from '../../app'


const {
    Service: S,
} = constants

export function sleep(milisec: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milisec))
}

export function mockConfigProvider(settings: object = {}): IConfigurationProvider {
    const MockConfigProviderClass = mock<IConfigurationProvider>()
    const resolver = (key: string) => {
        if (settings[key] !== undefined) {
            return Maybe.Just(settings[key])
        }
        return Maybe.Nothing()
    }
    when(MockConfigProviderClass.get(anything())).thenCall(resolver)
    when(MockConfigProviderClass.get(anything(), anything())).thenCall(resolver)
    return instance(MockConfigProviderClass)
}

export async function mockMediateRpcCaller(config: IConfigurationProvider,
    preInit: boolean = true, callerName: string = 'caller'
): Promise<[IMediateRpcCaller, IMessageBrokerConnector, IMessageBrokerConnectorProvider]> {
    const serviceSlug = config.get(S.SERVICE_SLUG).tryGetValue('mock-service-slug')
    const connector = new TopicMessageBrokerConnector(serviceSlug)
    const MockConnProviderCaller = mock<IMessageBrokerConnectorProvider>()
    when(MockConnProviderCaller.create(anything())).thenResolve(connector)
    const caller = new MessageBrokerRpcCaller(config, instance(MockConnProviderCaller))
    if (preInit) {
        await caller.init({
            connector,
            callerName: callerName,
        })
    }
    return [caller, connector, MockConnProviderCaller]
}

export async function mockMediateRpcHandler(config: IConfigurationProvider,
    preInit: boolean = true, handlerName: string = 'handler'
): Promise<[IMediateRpcHandler, IMessageBrokerConnector, IMessageBrokerConnectorProvider]> {
    const serviceSlug = config.get(S.SERVICE_SLUG).tryGetValue('mock-service-slug')
    const connector = new TopicMessageBrokerConnector(serviceSlug)
    const MockConnProviderHandler = mock<IMessageBrokerConnectorProvider>()
    when(MockConnProviderHandler.create(anything())).thenResolve(connector)
    const handler = new MessageBrokerRpcHandler(config, instance(MockConnProviderHandler))
    if (preInit) {
        await handler.init({
            connector,
            handlerName: handlerName,
        })
    }
    return [handler, connector, MockConnProviderHandler]
}
