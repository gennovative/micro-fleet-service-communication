import * as chai from 'chai'
import * as spies from 'chai-spies'
import { instance, when, verify, reset } from 'ts-mockito'
import { constants, IConfigurationProvider } from '@micro-fleet/common'

import { IMessageBrokerConnector, MessageBrokerProviderAddOn,
    MessageBrokerConnectionOptions } from '../app'
import { mockConfigProvider, betterMock } from './shared/helper'

chai.use(spies)
const expect = chai.expect
const CONN_NAMES = ['conn1', 'conn2', 'conn3']
const { MessageBroker: S } = constants


let config: IConfigurationProvider,
    MbConnectorClass: IMessageBrokerConnector,
    connectors: { [name: string]: IMessageBrokerConnector }

function createConnector(options: MessageBrokerConnectionOptions) {
    return connectors[options.name]
}

describe('MessageBrokerAddOn', function() {
    this.timeout(5000)
    // this.timeout(60e3) // For debugging

    before(() => {
        config = mockConfigProvider({
            [S.MSG_BROKER_USERNAME]: 'guest',
            [S.MSG_BROKER_PASSWORD]: 'guest',
            [S.MSG_BROKER_EXCHANGE]: 'amq.topic',
        })

        MbConnectorClass = betterMock<IMessageBrokerConnector>()
        connectors = CONN_NAMES.reduce((prev, cur) => {
            return {
                ...prev,
                [cur]: instance(MbConnectorClass),
            }
        }, {})
    })

    beforeEach(() => {
        reset(MbConnectorClass)
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

    describe('deadLetter', () => {
        it('should call all connectors stopListen()', async () => {
            // Arrange
            const ConnectorClassA = betterMock<IMessageBrokerConnector>()
            when(ConnectorClassA.stopListen()).thenResolve()

            const ConnectorClassB = betterMock<IMessageBrokerConnector>()
            when(ConnectorClassB.stopListen()).thenResolve()
            const addOn = new MessageBrokerProviderAddOn(createConnector, config)

            addOn['_connectors'] = [
                instance(ConnectorClassA),
                instance(ConnectorClassB),
            ]

            // Act
            await addOn.deadLetter()

            // Assert
            verify(ConnectorClassA.stopListen()).once()
            verify(ConnectorClassB.stopListen()).once()
        })
    }) // END describe 'dispose'

    describe('dispose', () => {
        it('should call all connectors disconnect()', async () => {
            // Arrange
            const ConnectorClassA = betterMock<IMessageBrokerConnector>()
            when(ConnectorClassA.disconnect()).thenResolve()

            const ConnectorClassB = betterMock<IMessageBrokerConnector>()
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

    describe('create', () => {
        it('should call createConnector() factory', async () => {
            // Arrange
            when(MbConnectorClass.connect()).thenResolve()
            const provider = new MessageBrokerProviderAddOn(createConnector, config)
            await provider.init()

            // Act
            const createdConns = CONN_NAMES.map(name => provider.create(name))

            // Assert
            expect(provider['_connectors'].length).to.equal(createdConns.length)
            createdConns.forEach((conn, i) => {
                expect(conn).to.equal(connectors[CONN_NAMES[i]])
            })
        })
    }) // END describe 'create'

    describe('getAll', () => {
        it('should return all connectors', async () => {
            // Arrange
            const provider = new MessageBrokerProviderAddOn(createConnector, config)
            await provider.init()
            const createdConns = await Promise.all(CONN_NAMES.map(name => provider.create(name)))

            // Act
            const allConns = provider.getAll()

            // Assert
            expect(provider['_connectors'].length).to.equal(allConns.length)
            createdConns.forEach((conn, i) => {
                expect(conn).to.equal(allConns[i])
            })
        })
    }) // END describe 'getAll'

    describe('get', () => {
        it('should return the connector with specified name', async () => {
            // Arrange
            when(MbConnectorClass.name).thenReturn(CONN_NAMES[1])
            const provider = new MessageBrokerProviderAddOn(createConnector, config)
            await provider.init()
            const createdConns = await Promise.all(CONN_NAMES.map(name => provider.create(name)))

            // Act
            const foundConn = provider.get(CONN_NAMES[1])

            // Assert
            expect(createdConns[1]).to.equal(foundConn)
        })
    }) // END describe 'getAll'
})
