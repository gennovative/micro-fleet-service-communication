export enum Types {
    BROKER_ADDON = 'service-communication.MessageBrokerAddOn',
    RPC_CALLER = 'service-communication.IRpcCaller',
    RPC_HANDLER = 'service-communication.IRpcHandler',
    DIRECT_RPC_HANDLER_ADDON = 'service-communication.DirectRpcHandlerAddOn',
    DIRECT_RPC_CALLER = 'service-communication.IDirectRpcCaller',
    DIRECT_RPC_HANDLER = 'service-communication.IDirectRpcHandler',
    MEDIATE_RPC_HANDLER_ADDON = 'service-communication.MediateRpcHandlerAddOn',
    MEDIATE_RPC_CALLER = 'service-communication.IMediateRpcCaller',
    MEDIATE_RPC_HANDLER = 'service-communication.IMediateRpcHandler',
    MSG_BROKER_CONNECTOR = 'service-communication.IMessageBrokerConnector',
    MSG_BROKER_CONNECTOR_PROVIDER = 'service-communication.IMessageBrokerConnectionProvider',
}
