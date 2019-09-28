import * as chai from 'chai'
import * as spies from 'chai-spies'
import { mock, instance, when, verify } from 'ts-mockito'
import { constants, IConfigurationProvider } from '@micro-fleet/common'

import { IMessageBrokerConnector, MessageBrokerProviderAddOn } from '../app'
import { mockConfigProvider } from './shared/helper'


chai.use(spies)
const expect = chai.expect
const { MessageBroker: S } = constants


let config: IConfigurationProvider,
    connector: IMessageBrokerConnector

function createConnector() {
    return connector
}

describe('MessageBrokerAddOn', () => {
    beforeEach(() => {
        config = mockConfigProvider({
            [S.MSG_BROKER_USERNAME]: 'guest',
            [S.MSG_BROKER_PASSWORD]: 'guest',
            [S.MSG_BROKER_EXCHANGE]: 'amq.topic',
        })

        const MbConnectorClass = mock<IMessageBrokerConnector>()
        connector = instance(MbConnectorClass)
    })

    describe('init', () => {
        it('should retrieve connector options', async () => {
            // Arrange
            const addOn = new MessageBrokerProviderAddOn(createConnector, config)

            // Act
            await addOn.init()

            // Assert
            expect(addOn['_connectorOptions']).to.exist
            expect(addOn['_connectorOptions'].username).to.equal('guest')
            expect(addOn['_connectorOptions'].password).to.equal('guest')
            expect(addOn['_connectorOptions'].exchange).to.equal('amq.topic')
        })
    }) // END describe 'init'

    describe('dispose', () => {
        it('should call connector.disconnect', async () => {
            // Arrange
            const ConnectorClassA = mock<IMessageBrokerConnector>()
            when(ConnectorClassA.disconnect()).thenResolve()

            const ConnectorClassB = mock<IMessageBrokerConnector>()
            when(ConnectorClassB.disconnect()).thenResolve()
            const addOn = new MessageBrokerProviderAddOn(createConnector, config)

            addOn['_connectors'] = [
                instance(ConnectorClassA),
                instance(ConnectorClassB),
            ]

            // Act
            await addOn.dispose()

            // Assert
            verify(ConnectorClassA.disconnect()).once()
            verify(ConnectorClassB.disconnect()).once()
            expect(addOn['_connectors']).to.be.empty
        })
    }) // END describe 'dispose'
})
