import { decorators as d, Types as ConT, IConfigurationProvider, constants,
    Guard, IServiceAddOn } from '@micro-fleet/common'

import { IDENTIFIER as MSG_BROKER_CONNECTOR, IMessageBrokerConnector,
    MessageBrokerConnectionOptions, MessageBrokerConnectorFactory } from './MessageBrokerConnector'

const { MessageBroker: S } = constants


export interface IMessageBrokerConnectorProvider {
    /**
     * Establishes new connection to message broker and returns an instance of the connector.
     * @param name The connector name for later reference.
     */
    create(name: string): IMessageBrokerConnector

    /**
     * Gets all created and managed connectors.
     */
    getAll(): IMessageBrokerConnector[]

    /**
     * Gets a connector by its name.
     */
    get(name: string): IMessageBrokerConnector
}


@d.injectable()
export class MessageBrokerProviderAddOn implements IServiceAddOn, IMessageBrokerConnectorProvider {

    public readonly name: string = 'MessageBrokerProviderAddOn'

    private _connectorOptions: Partial<MessageBrokerConnectionOptions>
    private _connectors: IMessageBrokerConnector[]

    constructor(
        @d.inject(MSG_BROKER_CONNECTOR) private _createConnector: MessageBrokerConnectorFactory,
        @d.inject(ConT.CONFIG_PROVIDER) private _configProvider: IConfigurationProvider,
    ) {
        Guard.assertArgDefined('_configProvider', _configProvider)
        this._connectors = []
    }


    //#region Implements IMessageBrokerConnectorProvider

    /**
     * @see IMessageBrokerConnectorProvider.create
     */
    public create(name: string): IMessageBrokerConnector {
        Guard.assertIsDefined(this._connectorOptions, 'MessageBrokerProviderAddOn must be initialized before creating connectors.')
        const connector = this._createConnector({
            ...this._connectorOptions as MessageBrokerConnectionOptions,
            name,
        })
        this._connectors.push(connector)
        return connector
    }

    /**
     * @see IMessageBrokerConnectorProvider.getAll
     */
    public getAll(): IMessageBrokerConnector[] {
        return [...this._connectors]
    }

    /**
     * @see IMessageBrokerConnectorProvider.get
     */
    public get(name: string): IMessageBrokerConnector {
        return this._connectors.find(c => c.name === name)
    }

    //#endregion Implements IMessageBrokerConnectorProvider


    //#region Implements IServiceAddOn

    /**
     * @see IServiceAddOn.init
     */
    public init(): Promise<void> {
        const cfgAdt = this._configProvider
        this._connectorOptions = {
                hostAddress: cfgAdt.get(S.MSG_BROKER_HOST).tryGetValue('localhost') as string,
                username: cfgAdt.get(S.MSG_BROKER_USERNAME).value as string,
                password: cfgAdt.get(S.MSG_BROKER_PASSWORD).value as string,
                exchange: cfgAdt.get(S.MSG_BROKER_EXCHANGE).value as string,
                queue: cfgAdt.get(S.MSG_BROKER_HANDLER_QUEUE).tryGetValue(null) as string,
                reconnectDelay: cfgAdt.get(S.MSG_BROKER_RECONN_TIMEOUT).tryGetValue(3000) as number,
                messageExpiredIn: cfgAdt.get(S.MSG_BROKER_MSG_EXPIRE).tryGetValue(50000) as number,
            }
        return Promise.resolve()
    }

    /**
     * @see IServiceAddOn.deadLetter
     */
    public deadLetter(): Promise<void> {
        return Promise.all(this._connectors.map(c => c.stopListen())) as Promise<any>
    }

    /**
     * @see IServiceAddOn.dispose
     */
    public dispose(): Promise<void> {
        return Promise
            .all(this._connectors.map(c => c.disconnect()))
            .then(() => this._connectors = []) as Promise<any>
    }

    //#endregion Implements IServiceAddOn

}
