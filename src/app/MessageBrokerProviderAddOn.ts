import { decorators as d, Types as ConT, IConfigurationProvider, constants,
    Guard, IServiceAddOn, IDependencyContainer } from '@micro-fleet/common'

import { IMessageBrokerConnector, MessageBrokerConnectionOptions} from './MessageBrokerConnector'
import { Types as T } from './constants/Types'

const { MessageBroker: S } = constants


export interface IMessageBrokerConnectionProvider {
    /**
     * Establishes new connection to message broker and returns an instance of the connector.
     * @param name The connector name for later reference.
     */
    create(name: string): Promise<IMessageBrokerConnector>

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
export class MessageBrokerProviderAddOn implements IServiceAddOn, IMessageBrokerConnectionProvider {

    public readonly name: string = 'MessageBrokerProviderAddOn'

    private _connectorOptions: MessageBrokerConnectionOptions
    private _connectors: IMessageBrokerConnector[]

    constructor(
        @d.inject(ConT.CONFIG_PROVIDER) private _configProvider: IConfigurationProvider,
        @d.inject(ConT.DEPENDENCY_CONTAINER) private _depContainer: IDependencyContainer,
        // @d.inject(T.MSG_BROKER_CONNECTOR) private _msgBrokerCnn: IMessageBrokerConnector
    ) {
        Guard.assertArgDefined('_configProvider', _configProvider)
        // Guard.assertArgDefined('_msgBrokerCnn', _msgBrokerCnn)
        this._connectors = []
    }


    //#region Implements IMessageBrokerConnectionProvider

    /**
     * @see IServiceAddOn.init
     */
    public async create(name: string): Promise<IMessageBrokerConnector> {
        const connector = this._depContainer.resolve<IMessageBrokerConnector>(T.MSG_BROKER_CONNECTOR)
        await connector.connect(this._connectorOptions)
        this._connectors.push(connector)
        return connector
    }

    /**
     * @see IServiceAddOn.init
     */
    public getAll(): IMessageBrokerConnector[] {
        
    }

    /**
     * @see IServiceAddOn.init
     */
    public get(name: string): IMessageBrokerConnector {
        
    }

    //#endregion Implements IMessageBrokerConnectionProvider


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
                handlerQueue: cfgAdt.get(S.MSG_BROKER_HANDLER_QUEUE).tryGetValue(null) as string,
                reconnectDelay: cfgAdt.get(S.MSG_BROKER_RECONN_TIMEOUT).tryGetValue(3000) as number,
                messageExpiredIn: cfgAdt.get(S.MSG_BROKER_MSG_EXPIRE).tryGetValue(50000) as number,
            }
        return Promise.resolve()
    }

    /**
     * @see IServiceAddOn.deadLetter
     */
    public deadLetter(): Promise<void> {
        return this._msgBrokerCnn.stopListen()
    }

    /**
     * @see IServiceAddOn.dispose
     */
    public dispose(): Promise<void> {
        return this._msgBrokerCnn.disconnect()
    }

    //#endregion Implements IServiceAddOn

}
