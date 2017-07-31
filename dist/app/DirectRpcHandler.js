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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const bodyParser = require("body-parser");
const back_lib_common_util_1 = require("back-lib-common-util");
const rpc = require("./RpcCommon");
let ExpressRpcHandler = ExpressRpcHandler_1 = class ExpressRpcHandler extends rpc.RpcHandlerBase {
    constructor(depContainer) {
        super(depContainer);
    }
    /**
     * @see IDirectRpcHandler.init
     */
    init(param) {
        back_lib_common_util_1.Guard.assertIsFalsey(this._router, 'This RPC Caller is already initialized!');
        back_lib_common_util_1.Guard.assertIsTruthy(this._name, '`name` property must be set!');
        let app;
        app = this._app = (param && param.expressApp)
            ? param.expressApp
            : express();
        this._router = (param && param.expressRouter) ? param.expressRouter : express.Router();
        //app.use(bodyParser.urlencoded({extended: true})); // Parse Form values in POST request, but I don't think we need it in this case.
        app.use(bodyParser.json()); // Parse JSON in POST request
        app.use(`/${this._name}`, this._router);
    }
    /**
     * @see IDirectRpcHandler.start
     */
    start() {
        return new Promise((resolve, reject) => {
            this._server = this._app.listen(3000, resolve);
            this._server.on('error', err => this.emitError(err));
        });
    }
    /**
     * @see IDirectRpcHandler.dispose
     */
    dispose() {
        return new Promise((resolve, reject) => {
            this._server.close(() => {
                this._server = null;
                resolve();
            });
        });
    }
    /**
     * @see IRpcHandler.handle
     */
    handle(action, dependencyIdentifier, actionFactory) {
        back_lib_common_util_1.Guard.assertIsMatch(ExpressRpcHandler_1.URL_TESTER, action, `Route "${action}" is not URL-safe!`);
        back_lib_common_util_1.Guard.assertIsDefined(this._router, '`init` method must be called first!');
        this._router.post(`/${action}`, this.buildHandleFunc.apply(this, arguments));
    }
    buildHandleFunc(action, dependencyIdentifier, actionFactory) {
        return (req, res) => {
            let request = req.body;
            (new Promise((resolve, reject) => {
                let actionFn = this.resolveActionFunc(action, dependencyIdentifier, actionFactory);
                // Execute controller's action
                actionFn(request, resolve, reject);
            }))
                .then(result => {
                res.status(200).send(this.createResponse(true, result, request.from));
            })
                .catch(error => {
                let errMsg = error, statusCode = 200;
                // If error is an uncaught Exception object, that means the action method
                // has a problem. We should response with error status code.
                if (error instanceof back_lib_common_util_1.Exception) {
                    // TODO: Should log this unexpected error.
                    statusCode = 500;
                    errMsg = error.message;
                }
                // If this is a reject error, which means the action method sends this error
                // back to caller on purpose.
                res.status(statusCode).send(this.createResponse(false, errMsg, request.from));
            });
        };
    }
};
ExpressRpcHandler.URL_TESTER = (function () {
    let regexp = new RegExp(/^[a-zA-Z0-9_-]*$/);
    regexp.compile();
    return regexp;
})();
ExpressRpcHandler = ExpressRpcHandler_1 = __decorate([
    back_lib_common_util_1.injectable(),
    __param(0, back_lib_common_util_1.inject(back_lib_common_util_1.Types.DEPENDENCY_CONTAINER)),
    __metadata("design:paramtypes", [Object])
], ExpressRpcHandler);
exports.ExpressRpcHandler = ExpressRpcHandler;
var ExpressRpcHandler_1;

//# sourceMappingURL=DirectRpcHandler.js.map
