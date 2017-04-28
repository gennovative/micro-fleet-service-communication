declare module 'back-lib-service-communication/RpcCommon' {
	import { IDependencyContainer } from 'back-lib-common-util';
	export interface IRpcRequest extends Json {
	    from: string;
	    to: string;
	    params: any;
	}
	export interface IRpcResponse extends Json {
	    isSuccess: boolean;
	    from: string;
	    to: string;
	    data: any;
	}
	export interface IRpcCaller {
	    /**
	     * A name used in "from" and "to" request property.
	     */
	    name: string;
	    /**
	     * Listens to `route`, resolves an instance with `dependencyIdentifier`
	     * when there is a request coming, calls instance's `action` method. If `actions`
	     * is not specified, RPC Caller tries to figure out an action method from `route`.
	     */
	    call(moduleName: string, action: string, params: any): Promise<IRpcResponse>;
	    /**
	     * Sets up this RPC caller with specified `param`. Each implementation class requires
	     * different kinds of `param`.
	     */
	    init(param: any): any;
	}
	export type RpcControllerFunction = (request: IRpcRequest, resolve: PromiseResolveFn, reject: PromiseRejectFn) => void;
	export type RpcActionFactory = (controller) => RpcControllerFunction;
	export interface IRpcHandler {
	    /**
	     * A name used in "from" and "to" request property.
	     */
	    name: string;
	    /**
	     * Waits for incoming request, resolves an instance with `dependencyIdentifier`,
	     * calls instance's `action` method. If `customAction` is specified,
	     * calls instance's `customAction` instead.
	     */
	    handle(action: string, dependencyIdentifier: string | symbol, actionFactory?: RpcActionFactory): any;
	    /**
	     * Sets up this RPC handler with specified `param`. Each implementation class requires
	     * different kinds of `param`.
	     */
	    init(param?: any): void;
	}
	export abstract class RpcCallerBase {
	    protected _name: string;
	    name: string;
	}
	export abstract class RpcHandlerBase {
	    protected _depContainer: IDependencyContainer;
	    protected _name: string;
	    name: string;
	    constructor(_depContainer: IDependencyContainer);
	    protected resolveActionFunc(action: string, depId: string | symbol, actFactory?: RpcActionFactory): RpcControllerFunction;
	    protected createResponse(isSuccess: any, data: any, replyTo: string): IRpcResponse;
	}

}
declare module 'back-lib-service-communication/DirectRpcCaller' {
	import * as rpc from 'back-lib-service-communication/RpcCommon';
	export interface IDirectRpcCaller extends rpc.IRpcCaller {
	    /**
	     * IP address or host name including port number.
	     * Do not include protocol (http, ftp...) because different class implementations
	     * will prepend different protocols.
	     */
	    baseAddress: string;
	}
	export class HttpRpcCaller extends rpc.RpcCallerBase implements IDirectRpcCaller {
	    constructor();
	    baseAddress: string;
	    init(param: any): void;
	    call(moduleName: string, action: string, params: any): Promise<rpc.IRpcResponse>;
	}

}
declare module 'back-lib-service-communication/DirectRpcHandler' {
	import { IDependencyContainer } from 'back-lib-common-util';
	import * as rpc from 'back-lib-service-communication/RpcCommon';
	export interface IDirectRpcHandler extends rpc.IRpcHandler {
	}
	export class ExpressRpcHandler extends rpc.RpcHandlerBase implements IDirectRpcHandler {
	    constructor(depContainer: IDependencyContainer);
	    init(param?: any): void;
	    handle(action: string, dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): void;
	}

}
declare module 'back-lib-service-communication/Types' {
	export class Types {
	    static readonly DIRECT_RPC_CALLER: symbol;
	    static readonly DIRECT_RPC_HANDLER: symbol;
	    static readonly MEDIATE_RPC_CALLER: symbol;
	    static readonly MEDIATE_RPC_HANDLER: symbol;
	    static readonly MSG_BROKER_CONNECTOR: symbol;
	}

}
declare module 'back-lib-service-communication/MessageBrokerConnector' {
	import * as amqp from 'amqplib';
	export type MessageHandleFunction = (msg: IMessage, ack?: () => void, nack?: () => void) => void;
	export type RpcHandleFunction = (msg: IMessage, reply: (response: any) => void, deny?: () => void) => void;
	export interface IMessage {
	    data: any;
	    raw: amqp.Message;
	    properties?: IPublishOptions;
	}
	export interface IPublishOptions {
	    contentType?: string;
	    contentEncoding?: string;
	    correlationId?: string;
	    replyTo?: string;
	}
	export interface IConnectionOptions {
	    hostAddress: string;
	    username: string;
	    password: string;
	    exchange: string;
	    queue: string;
	}
	export interface IMessageBrokerConnector {
	    /**
	     * Creates a connection to message broker engine.
	     * @param {IConnectionOptions} options
	     */
	    connect(options: IConnectionOptions): Promise<void>;
	    /**
	     * Closes all channels and the connection.
	     */
	    disconnect(): Promise<void>;
	    /**
	     * Sends `message` to the broker and label the message with `topic`.
	     * @param {string} topic - A name to label the message with. Should be in format "xxx.yyy.zzz".
	     * @param {string | Json | JsonArray} payload - A message to send to broker.
	     * @param {IPublishOptions} options - Options to add to message properties.
	     */
	    publish(topic: string, payload: string | Json | JsonArray, options?: IPublishOptions): Promise<void>;
	    /**
	     * Listens to messages whose label matches `matchingPattern`.
	     * @param {string} matchingPattern - Pattern to match with message label. Should be in format "xx.*" or "xx.#.#".
	     * @param {function} onMessage - Callback to invoke when there is an incomming message.
	     * @return {string} - A promise with resolve to a consumer tag, which is used to unsubscribe later.
	     */
	    subscribe(matchingPattern: string, onMessage: MessageHandleFunction, noAck?: boolean): Promise<string>;
	    /**
	     * Stop listening to a subscription that was made before.
	     */
	    unsubscribe(consumerTag: string): Promise<void>;
	    onError(handler: Function): void;
	}
	export class TopicMessageBrokerConnector implements IMessageBrokerConnector {
	    constructor();
	    connect(options: IConnectionOptions): Promise<void>;
	    disconnect(): Promise<void>;
	    subscribe(matchingPattern: string, onMessage: MessageHandleFunction, noAck?: boolean): Promise<string>;
	    publish(topic: string, payload: string | Json | JsonArray, options?: IPublishOptions): Promise<void>;
	    unsubscribe(consumerTag: string): Promise<void>;
	    onError(handler: Function): void;
	}

}
declare module 'back-lib-service-communication/MediateRpcCaller' {
	import { IMessageBrokerConnector } from 'back-lib-service-communication/MessageBrokerConnector';
	import * as rpc from 'back-lib-service-communication/RpcCommon';
	export interface IMediateRpcCaller extends rpc.IRpcCaller {
	}
	export class MessageBrokerRpcCaller extends rpc.RpcCallerBase implements IMediateRpcCaller {
	    constructor(_msgBrokerConn: IMessageBrokerConnector);
	    init(param: any): void;
	    call(moduleName: string, action: string, params: any): Promise<rpc.IRpcResponse>;
	}

}
declare module 'back-lib-service-communication/MediateRpcHandler' {
	import { IDependencyContainer } from 'back-lib-common-util';
	import { IMessageBrokerConnector } from 'back-lib-service-communication/MessageBrokerConnector';
	import * as rpc from 'back-lib-service-communication/RpcCommon';
	export interface IMediateRpcHandler extends rpc.IRpcHandler {
	}
	export class MessageBrokerRpcHandler extends rpc.RpcHandlerBase implements IMediateRpcHandler {
	    constructor(depContainer: IDependencyContainer, _msgBrokerCnn: IMessageBrokerConnector);
	    init(param?: any): void;
	    handle(action: string, dependencyIdentifier: string | symbol, actionFactory?: rpc.RpcActionFactory): void;
	}

}
declare module 'back-lib-service-communication' {
	export * from 'back-lib-service-communication/RpcCommon';
	export * from 'back-lib-service-communication/DirectRpcCaller';
	export * from 'back-lib-service-communication/DirectRpcHandler';
	export * from 'back-lib-service-communication/MediateRpcCaller';
	export * from 'back-lib-service-communication/MediateRpcHandler';
	export * from 'back-lib-service-communication/MessageBrokerConnector';
	export * from 'back-lib-service-communication/Types';
}
