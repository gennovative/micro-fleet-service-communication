"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var ExpressRpcHandler_1;
"use strict";
/// <reference types="debug" />
const debug = require('debug')('mcft:svccom:ExpressRpcHandler');
const express = require("express");
// import * as bodyParser from 'body-parser'
// import * as shortid from 'shortid';
const common_1 = require("@micro-fleet/common");
const rpc = require("../RpcCommon");
let ExpressRpcHandler = ExpressRpcHandler_1 = class ExpressRpcHandler extends rpc.RpcHandlerBase {
    constructor() {
        super();
        this._port = 30000;
        this._isOpen = false;
    }
    get port() {
        return this._port;
    }
    set port(val) {
        if (val > 0 && val <= 65535) {
            this._port = val;
            return;
        }
        throw new common_1.CriticalException('INVALID_PORT_DIRECT_RPC_HANDLER');
    }
    /**
     * @see IDirectRpcHandler.init
     */
    init(params) {
        common_1.Guard.assertIsFalsey(this._routers, 'This RPC Handler is already initialized!');
        common_1.Guard.assertIsTruthy(this.name, '`name` property must be set!');
        // this._instanceUid = shortid.generate();
        let app;
        app = this._app = express();
        app.disable('x-powered-by');
        app.use((req, res, next) => {
            // When `deadLetter()` is called, prevent all new requests.
            if (!this._isOpen) {
                return res.sendStatus(410); // Gone, https://httpstatuses.com/410
            }
            return next();
        });
        app.use(express.json()); // Parse JSON in POST request
        this._routers = new Map();
    }
    /**
     * @see IRpcHandler.start
     */
    start() {
        return new Promise(resolve => {
            this._server = this._app.listen(this._port, () => {
                debug(`Listening port ${this._port}`);
                this._isOpen = true;
                resolve();
            });
            this._server.on('error', err => this.emitError(err));
        });
    }
    /**
     * @see IRpcHandler.pause
     */
    pause() {
        this._isOpen = false;
        return Promise.resolve();
    }
    /**
     * @see IRpcHandler.resume
     */
    resume() {
        this._isOpen = true;
        return Promise.resolve();
    }
    /**
     * @see IRpcHandler.dispose
     */
    dispose() {
        return new Promise((resolve) => {
            if (!this._server) {
                return resolve();
            }
            this._server.close(() => {
                this._server = null;
                resolve();
            });
        });
    }
    /**
     * @see IRpcHandler.handle
     */
    handle(moduleName, actionName, handler) {
        common_1.Guard.assertIsDefined(this._routers, '`init` method must be called first!');
        common_1.Guard.assertIsMatch(ExpressRpcHandler_1.URL_TESTER, moduleName, `Module name "${moduleName}" is not URL-safe!`);
        common_1.Guard.assertIsMatch(ExpressRpcHandler_1.URL_TESTER, actionName, `Action name "${actionName}" is not URL-safe!`);
        let router;
        if (this._routers.has(moduleName)) {
            router = this._routers.get(moduleName);
        }
        else {
            router = express.Router();
            this._routers.set(moduleName, router);
            this._app.use(`/${moduleName}`, router);
            debug(`Created router for module: ${moduleName}`);
        }
        router.post(`/${actionName}`, this.wrapHandler(handler));
        debug(`Register action: ${actionName} to module ${moduleName}`);
    }
    wrapHandler(handler) {
        return (req, res, next) => {
            // const actionName = req.url.match(/[^\/]+$/)[0];
            const request = req.body;
            (new Promise((resolve, reject) => {
                const wrappedReject = (isIntended) => (reason) => reject({
                    isIntended,
                    reason,
                });
                try {
                    const output = handler({
                        payload: request.payload,
                        resolve,
                        reject: wrappedReject(true),
                        rpcRequest: request,
                        rawMessage: req,
                    });
                    if (output && typeof output.catch === 'function') {
                        output.catch(wrappedReject(false)); // Catch async exceptions.
                    }
                }
                catch (err) { // Catch normal exceptions.
                    wrappedReject(false)(err);
                }
            }))
                .then(result => {
                res.status(200).send(this.createResponse(true, result, request.from));
            })
                .catch((error) => {
                const errObj = this.createError(error);
                res.status(500).send(this.createResponse(false, errObj, request.from));
            })
                // Catch error thrown by `createError()`
                .catch(this.emitError.bind(this));
        };
    }
};
ExpressRpcHandler.URL_TESTER = (function () {
    const regexp = new RegExp(/^[a-zA-Z0-9_-]*$/);
    regexp.compile();
    return regexp;
})();
ExpressRpcHandler = ExpressRpcHandler_1 = __decorate([
    common_1.injectable(),
    __metadata("design:paramtypes", [])
], ExpressRpcHandler);
exports.ExpressRpcHandler = ExpressRpcHandler;
//# sourceMappingURL=DirectRpcHandler.js.map