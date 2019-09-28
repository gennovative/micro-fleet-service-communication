import { instance, when, anything } from 'ts-mockito'
import { Mocker } from 'ts-mockito/lib/Mock'
import { Types as cT, IConfigurationProvider, Maybe,
    DependencyContainer, serviceContext, IDependencyContainer
} from '@micro-fleet/common'

import * as app from '../../app'
import rabbitOpts from '../rabbit-options'


export const constants = {
    SERVICE_SLUG: 'test-service',
    CALLER_NAME: 'rpcCaller',
    CALLER_TIMEOUT: 5000,
    HANDLER_NAME: 'rpcHandler',
    HANDLER_PORT: 30e3,
    HANDLER_ADDR: `localhost:${30e3}`,
}

export function sleep(milisec: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milisec))
}


export function betterMock<T>(clazz?: (new(...args: any[]) => T) | (Function & { prototype: T }) ): T {
    const mocker = new Mocker(clazz)
    mocker['excludedPropertyNames'] = ['hasOwnProperty', 'then']
    return mocker.getMock()
}


export function mockDependencyContainer(): IDependencyContainer {
    const depContainer = new DependencyContainer()
    serviceContext.setDependencyContainer(depContainer)
    depContainer.bindConstant(cT.DEPENDENCY_CONTAINER, depContainer)
    return depContainer
}

export function mockConfigProvider(settings: object = {}): IConfigurationProvider {
    const MockConfigProviderClass = betterMock<IConfigurationProvider>()
    const resolver = (key: string) => {
        if (settings[key] !== undefined) {
            return Maybe.Just(settings[key], key)
        }
        return Maybe.Nothing(key)
    }
    when(MockConfigProviderClass.get(anything())).thenCall(resolver)
    when(MockConfigProviderClass.get(anything(), anything())).thenCall(resolver)
    return instance(MockConfigProviderClass)
}

export async function mockMediateRpcCaller(
    preInit: boolean = true
): Promise<[app.IMediateRpcCaller, app.IMessageBrokerConnector, app.IMessageBrokerConnectorProvider]> {
    const connector = new app.TopicMessageBrokerConnector({
        ...rabbitOpts,
        queue: null,
        name: constants.CALLER_NAME,
    })
    const MockConnProviderCaller = betterMock<app.IMessageBrokerConnectorProvider>()
    when(MockConnProviderCaller.create(anything())).thenReturn(connector)
    const caller = new app.MessageBrokerRpcCaller(instance(MockConnProviderCaller))
    if (preInit) {
        await caller.init({
            connector,
            callerName: constants.CALLER_NAME,
            timeout: constants.CALLER_TIMEOUT,
        })
    }
    return [caller, connector, MockConnProviderCaller]
}

export async function mockMediateRpcHandler(
    preInit: boolean = true,
): Promise<[app.IMediateRpcHandler, app.IMessageBrokerConnector, app.IMessageBrokerConnectorProvider]> {
    const connector = new app.TopicMessageBrokerConnector({
        ...rabbitOpts,
        name: constants.HANDLER_NAME,
    })
    const MockConnProviderHandler = betterMock<app.IMessageBrokerConnectorProvider>()
    when(MockConnProviderHandler.create(anything())).thenReturn(connector)
    const handler = new app.MessageBrokerRpcHandler(instance(MockConnProviderHandler))
    if (preInit) {
        await handler.init({
            connector,
            handlerName: constants.HANDLER_NAME,
        })
    }
    return [handler, connector, MockConnProviderHandler]
}

export async function mockDirectRpcCaller(): Promise<app.IDirectRpcCaller> {
    const caller = new app.HttpRpcCaller()
    await caller.init({
        callerName: constants.CALLER_NAME,
        baseAddress: constants.HANDLER_ADDR,
    })
    return caller
}

export function mockDefaultDirectRpcHandlerAddOn(config: IConfigurationProvider,
        depContainer: IDependencyContainer): [app.DefaultDirectRpcHandlerAddOn, app.IDirectRpcHandler] {
    const handler = new app.ExpressRpcHandler()

    return [
        new app.DefaultDirectRpcHandlerAddOn(config, depContainer, handler),
        handler,
    ]
}
