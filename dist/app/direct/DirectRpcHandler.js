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
var ExpressRpcHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
"use strict";
/// <reference types="debug" />
const debug = require('debug')('mcft:svccom:ExpressRpcHandler');
const express = require("express");
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
        return Promise.resolve();
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
            this._server.on('error', err => this._emitError(err));
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
    handle({ moduleName, actionName, handler, rawDest }) {
        common_1.Guard.assertIsDefined(this._routers, '`init` method must be called first!');
        moduleName && common_1.Guard.assertIsMatch(ExpressRpcHandler_1.URL_TESTER, moduleName, `Module name "${moduleName}" is not URL-safe!`);
        actionName && common_1.Guard.assertIsMatch(ExpressRpcHandler_1.URL_TESTER, actionName, `Action name "${actionName}" is not URL-safe!`);
        rawDest && common_1.Guard.assertIsMatch(ExpressRpcHandler_1.URL_TESTER, rawDest, `Raw destination "${rawDest}" is not URL-safe!`);
        let router;
        if (rawDest) {
            if (this._routers.has(rawDest)) {
                router = this._routers.get(rawDest);
            }
            else {
                router = express.Router();
                this._routers.set(rawDest, router);
                this._app.use(router);
                debug(`Created router for raw address: ${rawDest}`);
            }
            router.post('*', this.wrapHandler(handler));
            return Promise.resolve();
        }
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
        return Promise.resolve();
    }
    wrapHandler(handler) {
        return (req, res) => {
            const request = req.body;
            (new Promise(async (resolve, reject) => {
                const wrappedReject = (isIntended) => (reason) => reject({
                    isIntended,
                    reason,
                });
                try {
                    await handler({
                        payload: request.payload,
                        resolve,
                        reject: wrappedReject(true),
                        rpcRequest: request,
                        rawMessage: req,
                    });
                }
                catch (err) { // Catch normal exceptions.
                    let isIntended = false;
                    if (err instanceof common_1.ValidationError) {
                        isIntended = true;
                    }
                    wrappedReject(isIntended)(err);
                }
            }))
                .then(result => {
                res.status(200).send(this._createResponse(true, result, request.from));
            })
                .catch((error) => {
                if (!error.isIntended) {
                    this._emitError(error.reason);
                    res.sendStatus(500);
                    return;
                }
                const errObj = this._createError(error);
                res.status(200).send(this._createResponse(false, errObj, request.from));
            })
                // Catch error thrown by `createError()` or `createResponse()`
                .catch((error) => {
                this._emitError(error);
                res.sendStatus(500);
            });
        };
    }
};
ExpressRpcHandler.URL_TESTER = (function () {
    const regexp = new RegExp(/^[a-zA-Z0-9_-]*$/);
    regexp.compile();
    return regexp;
})();
ExpressRpcHandler = ExpressRpcHandler_1 = __decorate([
    common_1.decorators.injectable(),
    __metadata("design:paramtypes", [])
], ExpressRpcHandler);
exports.ExpressRpcHandler = ExpressRpcHandler;
//# sourceMappingURL=DirectRpcHandler.js.map