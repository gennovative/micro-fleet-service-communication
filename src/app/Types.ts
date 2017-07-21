export class Types {
	public static readonly DIRECT_RPC_CALLER = Symbol('IDirectRpcCaller');
	public static readonly DIRECT_RPC_HANDLER = Symbol('IDirectRpcHandler');
	public static readonly MEDIATE_RPC_CALLER = Symbol('IMediateRpcCaller');
	public static readonly MEDIATE_RPC_HANDLER = Symbol('IMediateRpcHandler');
	public static readonly MSG_BROKER_CONNECTOR = Symbol('IMessageBrokerConnector');
}