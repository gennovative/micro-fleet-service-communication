import { IConfigurationProvider, Types as ConT, constants, injectable,
    inject, Guard, IServiceAddOn } from '@micro-fleet/common'

import { IMessageBrokerConnector, MessageBrokerConnectionOptions} from './MessageBrokerConnector'
import { Types as T } from './constants/Types'

const { MbSettingKeys: S } = constants


@injectable()
export class MessageBrokerAddOn implements IServiceAddOn {

    public readonly name: string = 'MessageBrokerAddOn'

    constructor(
        @inject(ConT.CONFIG_PROVIDER) private _configProvider: IConfigurationProvider,
        @inject(T.MSG_BROKER_CONNECTOR) private _msgBrokerCnn: IMessageBrokerConnector
    ) {
        Guard.assertArgDefined('_configProvider', _configProvider)
        Guard.assertArgDefined('_msgBrokerCnn', _msgBrokerCnn)
    }

    /**
     * @see IServiceAddOn.init
     */
    public init(): Promise<void> {
        const cfgAdt = this._configProvider,
            opts: MessageBrokerConnectionOptions = {
                hostAddress: cfgAdt.get(S.MSG_BROKER_HOST).tryGetValue('localhost') as string,
                username: cfgAdt.get(S.MSG_BROKER_USERNAME).value as string,
                password: cfgAdt.get(S.MSG_BROKER_PASSWORD).value as string,
                exchange: cfgAdt.get(S.MSG_BROKER_EXCHANGE).value as string,
                queue: cfgAdt.get(S.MSG_BROKER_QUEUE).value as string,
                reconnectDelay: cfgAdt.get(S.MSG_BROKER_RECONN_TIMEOUT).tryGetValue(3000) as number,
                messageExpiredIn: cfgAdt.get(S.MSG_BROKER_MSG_EXPIRE).tryGetValue(50000) as number,
            }
        return this._msgBrokerCnn.connect(opts)
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
}
