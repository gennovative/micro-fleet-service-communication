/// <reference path="./global.d.ts" />
declare module '@micro-fleet/service-communication/dist/app/constants/controller' {
	export const INVERSIFY_INJECTABLE = "inversify:paramtypes";
	export type ControllerExports = {
	    [name: string]: Newable;
	};
	export enum ControllerCreationStrategy {
	    SINGLETON = 0,
	    TRANSIENT = 1
	}

}
declare module '@micro-fleet/service-communication/dist/app/constants/MetaData' {
	export class MetaData {
	    static readonly ACTION = "micro-fleet-svc-com:action";
	    static readonly ACTION_FILTER = "micro-fleet-svc-com:actionFilter";
	    static readonly CONTROLLER_DIRECT = "micro-fleet-svc-com:directController";
	    static readonly CONTROLLER_MEDIATE = "micro-fleet-svc-com:mediateController";
	    static readonly CONTROLLER_FILTER = "micro-fleet-svc-com:controllerFilter";
	}

}
declare module '@micro-fleet/service-communication/dist/app/RpcCommon' {
	/// <reference types="node" />
	import { EventEmitter } from 'events';
	import { IDependencyContainer } from '@micro-fleet/common';
	export type HandlerRejection = {
	    isIntended: boolean;
	    reason: any;
	};
	export type RpcError = {
	    type: string;
	    message?: string;
	    details?: any;
	};
	export type RpcRequest = {
	    from: string;
	    to: string;
	    payload: any;
	};
	export type RpcResponse = {
	    isSuccess: boolean;
	    from: string;
	    to: string;
	    payload: any;
	};
	export interface IRpcCaller {
	    /**
	     * A name used in "from" and "to" request property.
	     */
	    name: string;
	    /**
	     * Number of milliseconds to wait for response before cancelling the request.
	     * Must be between (inclusive) 1000 and 60000 (Min: 1s, Max: 60s).
	     */
	    timeout: number;
	    /**
	     * Sets up this RPC caller with specified `param`. Each implementation class requires
	     * different kinds of `param`.
	     */
	    init(params?: any): any;
	    /**
	     * Clear resources.
	     */
	    dispose(): Promise<void>;
	    /**
	     * Sends a request to `moduleName` to execute `action` with `params`.
	     * @param moduleName The module to send request.
	     * @param action The function name to call on `moduleName`.
	     * @param params Parameters to pass to function `action`.
	     */
	    call(moduleName: string, action: string, params?: any): Promise<RpcResponse>;
	    /**
	     * Registers a listener to handle errors.
	     */
	    onError(handler: (err: any) => void): void;
	}
	export type RpcHandlerParams = {
	    /**
	     * The data being sent.
	     */
	    payload: any;
	    /**
	     * Responds with success state.
	     */
	    resolve: PromiseResolveFn;
	    /**
	     * Responds with failure state.
	     */
	    reject: PromiseRejectFn;
	    /**
	     * The RPC request that contains payload.
	     */
	    rpcRequest: RpcRequest;
	    /**
	     * Is either raw HTTP request (direct RPC) or raw Message broker message
	     */
	    rawMessage: any;
	};
	export type RpcHandlerFunction = (params: RpcHandlerParams) => any;
	export interface IRpcHandler {
	    /**
	     * A name used in "from" and "to" request property.
	     */
	    name: string;
	    /**
	     * Sets up this RPC handler with specified `param`. Each implementation class requires
	     * different kinds of `param`.
	     */
	    init(params?: any): Promise<void>;
	    /**
	     * Waits for incoming request, resolves an instance with `dependencyIdentifier`,
	     * calls instance's `action` method. If `customAction` is specified,
	     * calls instance's `customAction` instead.
	     */
	    handle(module: string, actionName: string, handler: RpcHandlerFunction): Promise<void>;
	    /**
	     * Registers a listener to handle errors.
	     */
	    onError(handler: (err: any) => void): void;
	    /**
	     * Starts listening to requests.
	     */
	    start(): Promise<void>;
	    /**
	     * Keeps running, but not accepts any more incoming requests.
	     */
	    pause(): Promise<void>;
	    /**
	     * Continues to accept incoming requests.
	     */
	    resume(): Promise<void>;
	    /**
	     * Stops handling requests and removes registered actions.
	     */
	    dispose(): Promise<void>;
	    /**
	     * Registers a listener to handle errors.
	     */
	    onError(handler: (err: any) => void): void;
	}
	export abstract class RpcCallerBase {
	    /**
	     * @see IRpcCaller.name
	     */
	    name: string;
	    	    protected _emitter: EventEmitter;
	    constructor();
	    /**
	     * @see IRpcCaller.timeout
	     */
	    /**
	    * @see IRpcCaller.timeout
	    */
	    timeout: number;
	    dispose(): Promise<void>;
	    /**
	     * @see IRpcCaller.onError
	     */
	    onError(handler: (err: any) => void): void;
	    protected emitError(err: any): void;
	    protected rebuildError(error: Error | RpcResponse | string): Error;
	}
	export abstract class RpcHandlerBase {
	    protected _depContainer?: IDependencyContainer;
	    /**
	     * @see IRpcHandler.name
	     */
	    name: string;
	    protected _emitter: EventEmitter;
	    constructor(_depContainer?: IDependencyContainer);
	    /**
	     * @see IRpcHandler.onError
	     */
	    onError(handler: (err: any) => void): void;
	    protected emitError(err: any): void;
	    protected createResponse(isSuccess: boolean, payload: any, replyTo: string): RpcResponse;
	    protected createError({ isIntended, reason }: HandlerRejection): RpcError;
	}

}
declare module '@micro-fleet/service-communication/dist/app/ControllerHunter' {
	import { IDependencyContainer, Maybe } from '@micro-fleet/common';
	import { ControllerCreationStrategy, ControllerExports } from '@micro-fleet/service-communication/dist/app/constants/controller';
	import { IRpcHandler, RpcHandlerFunction } from '@micro-fleet/service-communication/dist/app/RpcCommon';
	export class ControllerHunter {
	    	    	    	    /**
	     * Gets or sets strategy when creating controller instance.
	     */
	    controllerCreation: ControllerCreationStrategy;
	    /**
	     * Gets or sets path to folder containing controller classes.
	     */
	    controllerPath: string;
	    constructor(_depContainer: IDependencyContainer, _rpcHandler: IRpcHandler, _controllerMeta: string, creationStrategy: ControllerCreationStrategy);
	    /**
	     * Scans "controllerPath" and registers controller classes
	     * decorated with "controllerMeta".
	     */
	    hunt(): Promise<void>;
	    protected _loadControllers(): Promise<ControllerExports>;
	    protected _initControllers(controllers: ControllerExports): Promise<void>;
	    protected _extractModuleName(CtrlClass: Newable): string;
	    protected _assertValidController(ctrlName: string, CtrlClass: Newable): void;
	    protected _initActions(CtrlClass: Newable, moduleName: string): Promise<void>;
	    protected _extractActionRoute(CtrlClass: Newable, funcName: string): string;
	    protected _extractActionFromPrototype(prototype: any, name: string): Maybe<RpcHandlerFunction>;
	    protected _proxyActionFunc(actionFunc: Function, CtrlClass: Newable): RpcHandlerFunction;
	    protected _getMetadata(metaKey: string, classOrProto: any, propName?: string): any;
	}

}
declare module '@micro-fleet/service-communication/dist/app/MessageBrokerConnector' {
	import * as amqp from 'amqplib';
	export type MessageHandleFunction = (msg: BrokerMessage, ack?: () => void, nack?: () => void) => void;
	export type BrokerMessage = {
	    data: any;
	    raw: amqp.Message;
	    properties?: MessageBrokerPublishOptions;
	};
	export type MessageBrokerPublishOptions = {
	    contentType?: 'text/plain' | 'application/json';
	    contentEncoding?: string;
	    correlationId?: string;
	    replyTo?: string;
	};
	export type MessageBrokerConnectionOptions = {
	    /**
	     * IP address or host name where message broker is located.
	     */
	    hostAddress: string;
	    /**
	     * Username to login to message broker.
	     */
	    username: string;
	    /**
	     * Password to login to message broker.
	     */
	    password: string;
	    /**
	     * Exchange name
	     */
	    exchange: string;
	    /**
	     * Milliseconds to wait before trying to reconnect to message broker.
	     */
	    reconnectDelay?: number;
	    /**
	     * The default queue name to bind.
	     * If not specified or given falsey values (empty string, null,...), a queue with random name will be created.
	     * IMessageBrokerConnector's implementation may allow connecting to many queues.
	     * But each TopicMessageBrokerConnector instance connects to only one queue.
	     */
	    queue?: string;
	    /**
	     * Milliseconds to expire messages arriving in the queue.
	     */
	    messageExpiredIn?: number;
	};
	export interface IMessageBrokerConnector {
	    /**
	     * Gets or sets queue name.
	     * Queue can only be changed before it is bound.
	     * Queue is bound on the first call to `subscribe()` method.
	     * @throws Error if changing queue after it is bound.
	     */
	    queue: string;
	    /**
	     * Gets or sets milliseconds to expire messages arriving in the queue.
	     * Can only be changed before queue is bound.
	     * Queue is bound on the first call to `subscribe()` method.
	     * @throws Error if changing queue after it is bound.
	     */
	    messageExpiredIn: number;
	    /**
	     * Gets array of subscribed matching patterns.
	     */
	    readonly subscribedPatterns: string[];
	    /**
	     * Creates a connection to message broker engine.
	     * @param {MessageBrokerConnectionOptions} options
	     */
	    connect(options: MessageBrokerConnectionOptions): Promise<void>;
	    /**
	     * Closes all channels and the connection.
	     */
	    disconnect(): Promise<void>;
	    /**
	     * Deletes queue.
	     */
	    deleteQueue(): Promise<void>;
	    /**
	     * Deletes all messages in queue.
	     * Note that this won't remove messages that have been delivered but not yet acknowledged.
	     * They will remain, and may be requeued under some circumstances
	     * (e.g., if the channel to which they were delivered closes without acknowledging them).
	     *
	     * @returns Number of deleted message.
	     */
	    emptyQueue(): Promise<number>;
	    /**
	     * Starts receiving messages.
	     * @param {function} onMessage - Callback to invoke when there is an incomming message.
	     * @param {boolean} noAck - If true, received message is acknowledged automatically.
	     *     Default should be `true`.
	     */
	    listen(onMessage: MessageHandleFunction, noAck?: boolean): Promise<void>;
	    /**
	     * Stops receiving messages.
	     */
	    stopListen(): Promise<void>;
	    /**
	     * Sends `message` to the broker and label the message with `topic`.
	     * @param {string} topic - A name to label the message with. Should be in format "xxx.yyy.zzz".
	     * @param {any} payload - A message to send to broker.
	     * @param {MessageBrokerPublishOptions} options - Options to add to message properties.
	     */
	    publish(topic: string, payload: any, options?: MessageBrokerPublishOptions): Promise<void>;
	    /**
	     * Listens to messages whose label matches `matchingPattern`.
	     * @param {string} matchingPattern - Pattern to match with message label. Should be in format "xx.*" or "xx.#.#".
	     */
	    subscribe(matchingPattern: string): Promise<void>;
	    /**
	     * Stops listening to a topic pattern.
	     */
	    unsubscribe(matchingPattern: string): Promise<void>;
	    /**
	     * Stops listening to all subscriptions.
	     */
	    unsubscribeAll(): Promise<void>;
	    /**
	     * Registers a listener to handle errors.
	     */
	    onError(handler: (err: any) => void): void;
	}
	export class TopicMessageBrokerConnector implements IMessageBrokerConnector {
	    	    	    	    	    	    	    	    	    	    	    	    	    	    constructor();
	    /**
	     * @see IMessageBrokerConnector.queue
	     */
	    /**
	    * @see IMessageBrokerConnector.queue
	    */
	    queue: string;
	    /**
	     * @see IMessageBrokerConnector.messageExpiredIn
	     */
	    /**
	    * @see IMessageBrokerConnector.messageExpiredIn
	    */
	    messageExpiredIn: number;
	    /**
	     * @see IMessageBrokerConnector.subscribedPatterns
	     */
	    readonly subscribedPatterns: string[];
	    	    /**
	     * @see IMessageBrokerConnector.connect
	     */
	    connect(options: MessageBrokerConnectionOptions): Promise<void>;
	    /**
	     * @see IMessageBrokerConnector.disconnect
	     */
	    disconnect(): Promise<void>;
	    /**
	     * @see IMessageBrokerConnector.deleteQueue
	     */
	    deleteQueue(): Promise<void>;
	    /**
	     * @see IMessageBrokerConnector.emptyQueue
	     */
	    emptyQueue(): Promise<number>;
	    /**
	     * @see IMessageBrokerConnector.listen
	     */
	    listen(onMessage: MessageHandleFunction, noAck?: boolean): Promise<void>;
	    /**
	     * @see IMessageBrokerConnector.stopListen
	     */
	    stopListen(): Promise<void>;
	    /**
	     * @see IMessageBrokerConnector.publish
	     */
	    publish(topic: string, payload: any, options?: MessageBrokerPublishOptions): Promise<void>;
	    /**
	     * @see IMessageBrokerConnector.subscribe
	     */
	    subscribe(matchingPattern: string): Promise<void>;
	    /**
	     * @see IMessageBrokerConnector.unsubscribe
	     */
	    unsubscribe(matchingPattern: string): Promise<void>;
	    /**
	     * @see IMessageBrokerConnector.unsubscribeAll
	     */
	    unsubscribeAll(): Promise<void>;
	    /**
	     * @see IMessageBrokerConnector.onError
	     */
	    onError(handler: (err: any) => void): void;
	    	    	    	    	    	    	    	    	    	    	    	    	    	}

}
declare module '@micro-fleet/service-communication/dist/app/Types' {
	export class Types {
	    static readonly BROKER_ADDON = "service-communication.MessageBrokerAddOn";
	    static readonly DIRECT_RPC_CALLER = "service-communication.IDirectRpcCaller";
	    static readonly DIRECT_RPC_HANDLER = "service-communication.IDirectRpcHandler";
	    static readonly MEDIATE_RPC_CALLER = "service-communication.IMediateRpcCaller";
	    static readonly MEDIATE_RPC_HANDLER = "service-communication.IMediateRpcHandler";
	    static readonly MSG_BROKER_CONNECTOR = "service-communication.IMessageBrokerConnector";
	}

}
declare module '@micro-fleet/service-communication/dist/app/MessageBrokerAddOn' {
	import { IConfigurationProvider } from '@micro-fleet/common';
	import { IMessageBrokerConnector } from '@micro-fleet/service-communication/dist/app/MessageBrokerConnector';
	export class MessageBrokerAddOn implements IServiceAddOn {
	    	    	    readonly name: string;
	    constructor(_configProvider: IConfigurationProvider, _msgBrokerCnn: IMessageBrokerConnector);
	    /**
	     * @see IServiceAddOn.init
	     */
	    init(): Promise<void>;
	    /**
	     * @see IServiceAddOn.deadLetter
	     */
	    deadLetter(): Promise<void>;
	    /**
	     * @see IServiceAddOn.dispose
	     */
	    dispose(): Promise<void>;
	}

}
declare module '@micro-fleet/service-communication/dist/app/decorators/controller' {
	export type ControllerDecorator = (moduleName?: string) => Function;
	/**
	 * Used to decorate controller class for direct RPC handler.
	 * @param {string} moduleName Module name, must be URL-safe
	 *         If '_' is given, it is extract from controller class name: {path}Controller.
	 *         If not specified, it is default to be empty string.
	 */
	export function directController(moduleName?: string): Function;
	/**
	 * Used to decorate controller class for mediate RPC handler.
	 * @param {string} moduleName Module name, must be URL-safe
	 *         If '_' is given, it is extract from controller class name: {path}Controller.
	 *         If not specified, it is default to be empty string.
	 */
	export function mediateController(moduleName?: string): Function;

}
declare module '@micro-fleet/service-communication/dist/app/decorators/filter' {
	/**
	 * Provides operations to intercept HTTP requests to a controller.
	 */
	export interface IActionFilter {
	    execute(request: any, response: any, next: Function, ...params: any[]): void | Promise<void>;
	}
	/**
	 * Provides operations to handle errors thrown from controller actions.
	 */
	export interface IActionErrorHandler {
	    execute(error: any, request: any, response: any, next: Function): void;
	}
	export type ActionInterceptor = IActionFilter | IActionErrorHandler;
	/**
	 * Represents the order in which filters are invoked.
	 */
	export enum FilterPriority {
	    LOW = 0,
	    MEDIUM = 1,
	    HIGH = 2
	}
	export type FilterDecorator = <T extends ActionInterceptor>(FilterClass: Newable<T>, priority?: FilterPriority, ...filterParams: any[]) => Function;
	export type FilterArray<T extends ActionInterceptor = ActionInterceptor> = {
	    FilterClass: Newable<T>;
	    filterParams: any[];
	}[];
	export type PrioritizedFilterArray = FilterArray[];
	/**
	 * Used to add filter to controller class and controller action.
	 * @param {class} FilterClass Filter class whose name must end with "Filter".
	 * @param {FilterPriority} priority Filters with greater priority run before ones with less priority.
	 */
	export function filter<T extends ActionInterceptor>(FilterClass: Newable<T>, priority?: FilterPriority, ...filterParams: any[]): Function;
	/**
	 * Adds a filter to `TargetClass`. `TargetClass` can be a class or class prototype,
	 * depending on whether the filter is meant to apply on class or class method.
	 * @param FilterClass The filter class.
	 * @param TargetClassOrPrototype A class or class prototype.
	 * @param targetFunc Method name, if `TargetClass` is prototype object,
	 * @param {FilterPriority} priority Filters with greater priority run before ones with less priority.
	 */
	export function addFilterToTarget<T extends ActionInterceptor>(FilterClass: Newable<T>, TargetClassOrPrototype: Newable<T>, targetFunc?: string, priority?: FilterPriority, ...filterParams: any[]): Function;
	/**
	 * Prepares a filter then push it to given array.
	 */
	export function pushFilterToArray<T extends ActionInterceptor>(filters: PrioritizedFilterArray, FilterClass: Newable<T>, priority?: FilterPriority, ...filterParams: any[]): void;

}
declare module '@micro-fleet/service-communication/dist/app/filters/ActionFilterBase' {
	export abstract class ActionFilterBase {
	    protected addReadonlyProp(obj: object, prop: string, value: any): void;
	}

}
declare module '@micro-fleet/service-communication/dist/app/filters/ModelFilter' {
	import { IActionFilter } from '@micro-fleet/service-communication/dist/app/decorators/filter';
	import { ActionFilterBase } from '@micro-fleet/service-communication/dist/app/filters/ActionFilterBase';
	export type ModelFilterOptions = {
	    /**
	     * Result object will be instance of this class.
	     */
	    ModelClass?: Newable;
	    /**
	     * Whether this request contains all properties of model class,
	     * or just some of them.
	     * Default: false
	     */
	    isPartial?: boolean;
	    /**
	     * Function to extract model object from request body.
	     * As default, model object is extracted from `request.body.model`.
	     */
	    modelPropFn?: <T extends object = object>(request: any) => any;
	    /**
	     * If true, this filter attaches tenantId to result object.
	     * tenantId should be resolved by `TenantResolverFilter`.
	     */
	    hasTenantId?: boolean;
	};
	export class ModelFilter extends ActionFilterBase implements IActionFilter {
	    execute(request: any, response: any, next: Function, options: ModelFilterOptions): void;
	}

}
declare module '@micro-fleet/service-communication/dist/app/decorators/model' {
	import { ModelFilterOptions } from '@micro-fleet/service-communication/dist/app/filters/ModelFilter';
	export type ModelDecorator = (opts: ModelFilterOptions) => Function;
	/**
	 * Attempts to translate request body to desired model class.
	 */
	export function model(opts: ModelFilterOptions): Function;

}
declare module '@micro-fleet/service-communication/dist/app/decorators/action' {
	export type ActionDecorator = (name?: string) => Function;
	/**
	 * Used to decorate action function of REST controller class.
	 * @param {string} method Case-insensitive HTTP verb supported by Express
	     *         (see full list at https://expressjs.com/en/4x/api.html#routing-methods)
	 * @param {string} name Segment of URL pointing to this action.
	 *         If not specified, it is default to be the action's function name.
	 */
	export function action(name?: string): Function;

}
declare module '@micro-fleet/service-communication/dist/app/decorators/index' {
	import { ControllerDecorator } from '@micro-fleet/service-communication/dist/app/decorators/controller';
	import { ModelDecorator } from '@micro-fleet/service-communication/dist/app/decorators/model';
	import { FilterDecorator } from '@micro-fleet/service-communication/dist/app/decorators/filter';
	import * as act from '@micro-fleet/service-communication/dist/app/decorators/action';
	export type Decorators = {
	    /**
	     * Used to decorate action function of REST controller class.
	     * @param {string} method Case-insensitive HTTP verb supported by Express
	     *         (see full list at https://expressjs.com/en/4x/api.html#routing-methods)
	     * @param {string} path Segment of URL pointing to this action.
	     *         If not specified, it is default to be the action's function name.
	     */
	    action: act.ActionDecorator;
	    /**
	     * Used to decorate controller class for direct RPC handler.
	     * @param {string} moduleName Module name, must be URL-safe
	     *         If '_' is given, it is extract from controller class name: {path}Controller.
	     *         If not specified, it is default to be empty string.
	     */
	    directController: ControllerDecorator;
	    /**
	     * Used to decorate controller class for direct RPC handler.
	     * @param {string} moduleName Module name, must be URL-safe
	     *         If '_' is given, it is extract from controller class name: {path}Controller.
	     *         If not specified, it is default to be empty string.
	     */
	    mediateController: ControllerDecorator;
	    /**
	     * Used to add filter to controller class and controller action.
	     * @param {class} FilterClass Filter class.
	     * @param {ExpressionStatement} filterFunc An arrow function that returns filter's function.
	     *         This array function won't be executed, but is used to extract filter function name.
	     * @param {number} priority A number from 0 to 10, filters with greater priority run before ones with less priority.
	     */
	    filter: FilterDecorator;
	    model: ModelDecorator;
	};
	export const decorators: Decorators;

}
declare module '@micro-fleet/service-communication/dist/app/direct/DirectRpcHandler' {
	import * as rpc from '@micro-fleet/service-communication/dist/app/RpcCommon';
	export interface IDirectRpcHandler extends rpc.IRpcHandler {
	    /**
	     * Http ports to listen
	     */
	    port: number;
	}
	export class ExpressRpcHandler extends rpc.RpcHandlerBase implements IDirectRpcHandler {
	    	    	    	    	    	    	    constructor();
	    port: number;
	    /**
	     * @see IDirectRpcHandler.init
	     */
	    init(params?: any): any;
	    /**
	     * @see IRpcHandler.start
	     */
	    start(): Promise<void>;
	    /**
	     * @see IRpcHandler.pause
	     */
	    pause(): Promise<void>;
	    /**
	     * @see IRpcHandler.resume
	     */
	    resume(): Promise<void>;
	    /**
	     * @see IRpcHandler.dispose
	     */
	    dispose(): Promise<void>;
	    /**
	     * @see IRpcHandler.handle
	     */
	    handle(moduleName: string, actionName: string, handler: rpc.RpcHandlerFunction): Promise<void>;
	    	}

}
declare module '@micro-fleet/service-communication/dist/app/direct/DirectRpcHandlerAddOnBase' {
	import { IConfigurationProvider } from '@micro-fleet/common';
	import { IDirectRpcHandler } from '@micro-fleet/service-communication/dist/app/direct/DirectRpcHandler';
	/**
	 * Base class for DirectRpcAddOn.
	 */
	export abstract class DirectRpcHandlerAddOnBase implements IServiceAddOn {
	    protected _configProvider: IConfigurationProvider;
	    protected _rpcHandler: IDirectRpcHandler;
	    abstract name: string;
	    constructor(_configProvider: IConfigurationProvider, _rpcHandler: IDirectRpcHandler);
	    /**
	     * @see IServiceAddOn.init
	     */
	    init(): Promise<void>;
	    /**
	     * @see IServiceAddOn.deadLetter
	     */
	    deadLetter(): Promise<void>;
	    /**
	     * @see IServiceAddOn.dispose
	     */
	    dispose(): Promise<void>;
	    protected abstract handleRequests(): Promise<any>;
	}

}
declare module '@micro-fleet/service-communication/dist/app/direct/DefaultDirectRpcHandlerAddOn' {
	import { IConfigurationProvider, IDependencyContainer } from '@micro-fleet/common';
	import { IDirectRpcHandler } from '@micro-fleet/service-communication/dist/app/direct/DirectRpcHandler';
	import { DirectRpcHandlerAddOnBase } from '@micro-fleet/service-communication/dist/app/direct/DirectRpcHandlerAddOnBase';
	import { ControllerCreationStrategy } from '@micro-fleet/service-communication/dist/app/constants/controller';
	/**
	 * Automatically registers classes decorated with `@directController()`
	 */
	export class DefaultDirectRpcHandlerAddOn extends DirectRpcHandlerAddOnBase {
	    protected _depContainer: IDependencyContainer;
	    name: string;
	    	    constructor(configProvider: IConfigurationProvider, _depContainer: IDependencyContainer, rpcHandler: IDirectRpcHandler);
	    /**
	     * Gets or sets strategy when creating controller instance.
	     */
	    controllerCreation: ControllerCreationStrategy;
	    /**
	     * Gets or sets path to folder containing controller classes.
	     */
	    controllerPath: string;
	    /**
	     * @see IServiceAddOn.deadLetter
	     */
	    deadLetter(): Promise<void>;
	    /**
	     * @override
	     */
	    protected handleRequests(): Promise<any>;
	    /**
	     * Registers a listener to handle errors.
	     */
	    onError(handler: (err: any) => void): void;
	}

}
declare module '@micro-fleet/service-communication/dist/app/direct/DirectRpcCaller' {
	import * as rpc from '@micro-fleet/service-communication/dist/app/RpcCommon';
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
	    /**
	     * @see IRpcCaller.init
	     */
	    init(param?: any): void;
	    /**
	     * @see IRpcCaller.dispose
	     */
	    dispose(): Promise<void>;
	    /**
	     * @see IRpcCaller.call
	     */
	    call(moduleName: string, action: string, params?: any): Promise<rpc.RpcResponse>;
	}

}
declare module '@micro-fleet/service-communication/dist/app/mediate/MediateRpcHandler' {
	import { IMessageBrokerConnector } from '@micro-fleet/service-communication/dist/app/MessageBrokerConnector';
	import * as rpc from '@micro-fleet/service-communication/dist/app/RpcCommon';
	export interface IMediateRpcHandler extends rpc.IRpcHandler {
	}
	export class MessageBrokerRpcHandler extends rpc.RpcHandlerBase implements IMediateRpcHandler {
	    	    	    constructor(_msgBrokerConn: IMessageBrokerConnector);
	    /**
	     * @see IRpcHandler.init
	     */
	    init(): Promise<void>;
	    /**
	     * @see IRpcHandler.start
	     */
	    start(): Promise<void>;
	    /**
	     * @see IRpcHandler.dispose
	     */
	    dispose(): Promise<void>;
	    /**
	     * @see IRpcHandler.pause
	     */
	    pause(): Promise<void>;
	    /**
	     * @see IRpcHandler.resume
	     */
	    resume(): Promise<void>;
	    /**
	     * @see IMediateRpcHandler.handle
	     */
	    handle(moduleName: string, actionName: string, handler: rpc.RpcHandlerFunction): Promise<void>;
	    	}

}
declare module '@micro-fleet/service-communication/dist/app/mediate/MediateRpcHandlerAddOnBase' {
	import { IConfigurationProvider } from '@micro-fleet/common';
	import { IMediateRpcHandler } from '@micro-fleet/service-communication/dist/app/mediate/MediateRpcHandler';
	/**
	 * Base class for MediateRpcAddOn.
	 */
	export abstract class MediateRpcHandlerAddOnBase implements IServiceAddOn {
	    protected _configProvider: IConfigurationProvider;
	    protected _rpcHandler: IMediateRpcHandler;
	    abstract name: string;
	    constructor(_configProvider: IConfigurationProvider, _rpcHandler: IMediateRpcHandler);
	    /**
	     * @see IServiceAddOn.init
	     */
	    init(): Promise<void>;
	    /**
	     * @see IServiceAddOn.deadLetter
	     */
	    deadLetter(): Promise<void>;
	    /**
	     * @see IServiceAddOn.dispose
	     */
	    dispose(): Promise<void>;
	    protected abstract handleRequests(): Promise<any>;
	}

}
declare module '@micro-fleet/service-communication/dist/app/mediate/DefaultMediateRpcHandlerAddOn' {
	import { IConfigurationProvider, IDependencyContainer } from '@micro-fleet/common';
	import { ControllerCreationStrategy } from '@micro-fleet/service-communication/dist/app/constants/controller';
	import { MediateRpcHandlerAddOnBase } from '@micro-fleet/service-communication/dist/app/mediate/MediateRpcHandlerAddOnBase';
	import { IMediateRpcHandler } from '@micro-fleet/service-communication/dist/app/mediate/MediateRpcHandler';
	/**
	 * Automatically registers classes decorated with `@directController()`
	 */
	export class DefaultMediateRpcHandlerAddOn extends MediateRpcHandlerAddOnBase {
	    protected _depContainer: IDependencyContainer;
	    name: string;
	    	    constructor(configProvider: IConfigurationProvider, _depContainer: IDependencyContainer, rpcHandler: IMediateRpcHandler);
	    /**
	     * Gets or sets strategy when creating controller instance.
	     */
	    controllerCreation: ControllerCreationStrategy;
	    /**
	     * Gets or sets path to folder containing controller classes.
	     */
	    controllerPath: string;
	    /**
	     * @see IServiceAddOn.deadLetter
	     */
	    deadLetter(): Promise<void>;
	    /**
	     * @override
	     */
	    protected handleRequests(): Promise<any>;
	    /**
	     * Registers a listener to handle errors.
	     */
	    onError(handler: (err: any) => void): void;
	}

}
declare module '@micro-fleet/service-communication/dist/app/mediate/MediateRpcCaller' {
	import { IMessageBrokerConnector } from '@micro-fleet/service-communication/dist/app/MessageBrokerConnector';
	import * as rpc from '@micro-fleet/service-communication/dist/app/RpcCommon';
	export interface IMediateRpcCaller extends rpc.IRpcCaller {
	}
	export class MessageBrokerRpcCaller extends rpc.RpcCallerBase implements IMediateRpcCaller {
	    	    constructor(_msgBrokerConn: IMessageBrokerConnector);
	    /**
	     * @see IRpcCaller.init
	     */
	    init(params?: any): void;
	    /**
	     * @see IRpcCaller.dispose
	     */
	    dispose(): Promise<void>;
	    /**
	     * @see IRpcCaller.call
	     */
	    call(moduleName: string, action: string, params?: any): Promise<rpc.RpcResponse>;
	}

}
declare module '@micro-fleet/service-communication' {
	export * from '@micro-fleet/service-communication/dist/app/RpcCommon';
	export * from '@micro-fleet/service-communication/dist/app/decorators';
	export * from '@micro-fleet/service-communication/dist/app/direct/DefaultDirectRpcHandlerAddOn';
	export * from '@micro-fleet/service-communication/dist/app/direct/DirectRpcCaller';
	export * from '@micro-fleet/service-communication/dist/app/direct/DirectRpcHandler';
	export * from '@micro-fleet/service-communication/dist/app/direct/DirectRpcHandlerAddOnBase';
	export * from '@micro-fleet/service-communication/dist/app/mediate/DefaultMediateRpcHandlerAddOn';
	export * from '@micro-fleet/service-communication/dist/app/mediate/MediateRpcCaller';
	export * from '@micro-fleet/service-communication/dist/app/mediate/MediateRpcHandler';
	export * from '@micro-fleet/service-communication/dist/app/mediate/MediateRpcHandlerAddOnBase';
	export * from '@micro-fleet/service-communication/dist/app/MessageBrokerAddOn';
	export * from '@micro-fleet/service-communication/dist/app/MessageBrokerConnector';
	export * from '@micro-fleet/service-communication/dist/app/Types';

}
declare module '@micro-fleet/service-communication/dist/app/filters/ErrorHandlerFilter' {
	import { IActionErrorHandler } from '@micro-fleet/service-communication/dist/app/decorators/filter';
	/**
	 * Catches unhandled exceptions from action methods.
	 */
	export class ErrorHandlerFilter implements IActionErrorHandler {
	    constructor();
	    execute(error: Error, req: any, res: any, next: Function): void;
	}

}
