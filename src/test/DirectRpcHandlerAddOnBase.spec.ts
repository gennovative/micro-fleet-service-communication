import * as chai from 'chai';
import * as spies from 'chai-spies';

import { RpcSettingKeys as RpcS, SvcSettingKeys as SvcS } from 'back-lib-common-constants';
import { IConfigurationProvider, Types as ConT } from 'back-lib-common-contracts';
import { injectable, inject, Guard, DependencyContainer } from 'back-lib-common-util';
import { IDirectRpcHandler, IMessageBrokerConnector, ExpressRpcHandler,
	DirectRpcHandlerAddOnBase, Types as ComT } from '../app';

chai.use(spies);
const expect = chai.expect;


const MODULE_NAME = 'testModule',
	HANDLER_PORT = 30000;

class MockConfigProvider implements IConfigurationProvider {
	
	get enableRemote(): boolean {
		return true;
	}

	public init(): Promise<void> {
		return Promise.resolve();
	}

	public deadLetter(): Promise<void> {
		return Promise.resolve();
	}

	public dispose(): Promise<void> {
		return Promise.resolve();
	}

	public onUpdate(listener: (changedKeys: string[]) => void) {

	}

	public get(key: string): number & boolean & string {
		return <any>(key == RpcS.RPC_HANDLER_PORT ? HANDLER_PORT : null);
	}

	public async fetch(): Promise<boolean> {
		return Promise.resolve(true);
	}
}


@injectable()
class CustomAddOn extends DirectRpcHandlerAddOnBase {

	constructor(
		@inject(ConT.CONFIG_PROVIDER) configProvider: IConfigurationProvider,
		@inject(ComT.DIRECT_RPC_HANDLER) rpcHandler: IDirectRpcHandler
	) {
		super(configProvider, rpcHandler);
	}

	/**
	 * @see IServiceAddOn.init
	 */
	public init(): Promise<void> {
		return super.init(MODULE_NAME);
	}

	/**
	 * @see IServiceAddOn.deadLetter
	 */
	public deadLetter(): Promise<void> {
		return super.deadLetter();
	}

	/**
	 * @see IServiceAddOn.dispose
	 */
	public dispose(): Promise<void> {
		return super.dispose();
	}

	/**
	 * @override
	 */
	protected handleRequests(): void {
		super.handleRequests();
		this._rpcHandler.handle('add', '');
	}
}


let depContainer: DependencyContainer,
	handler: IDirectRpcHandler,
	addon: CustomAddOn;

describe('DirectRpcHandlerAddOnBase', () => {

	beforeEach(() => {
		depContainer = new DependencyContainer();
		handler = new ExpressRpcHandler(depContainer);
		addon = new CustomAddOn(new MockConfigProvider(), handler);
	});

	describe('init', () => {
		it('Should set RPC handler name and port', async () => {
			// Act
			await addon.init();

			// Assert
			expect(addon['_rpcHandler'].name).to.equal(MODULE_NAME);
			expect(addon['_rpcHandler'].port).to.equal(HANDLER_PORT);

			await addon.dispose();
		});
	}); // END describe 'init'

	describe('dispose', () => {
		it('should call RPC handler.dispose', async () => {
			// Arrange
			let disconnectSpy = chai.spy.on(addon['_rpcHandler'], 'dispose');
			await addon.init();

			// Act
			await addon.dispose();

			// Assert
			expect(disconnectSpy).to.be.spy;
			expect(disconnectSpy).to.be.called.once;
		});
	}); // END describe 'dispose'
});