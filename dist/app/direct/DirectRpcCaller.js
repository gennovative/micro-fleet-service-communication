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
/// <reference types="debug" />
const debug = require('debug')('mcft:svccom:HttpRpcCaller');
const request = require("request-promise-native");
const common_1 = require("@micro-fleet/common");
const rpc = require("../RpcCommon");
const { Service: S, } = common_1.constants;
let HttpRpcCaller = class HttpRpcCaller extends rpc.RpcCallerBase {
    constructor(_config) {
        super();
        this._config = _config;
        this._requestMaker = request;
    }
    get baseAddress() {
        return this._baseAddress;
    }
    /**
     * @see IRpcCaller.init
     */
    init(options = {}) {
        this.$name = options.callerName || this._config.get(S.SERVICE_SLUG).value;
        this._baseAddress = options.baseAddress;
        return Promise.resolve();
    }
    /**
     * @see IRpcCaller.dispose
     */
    async dispose() {
        await super.dispose();
        this._requestMaker = null;
    }
    /**
     * @see IRpcCaller.call
     */
    call({ moduleName, actionName, params, rawDest }) {
        if (!rawDest) {
            common_1.Guard.assertArgDefined('moduleName', moduleName);
            common_1.Guard.assertArgDefined('actionName', actionName);
        }
        common_1.Guard.assertIsDefined(this._baseAddress, 'Base URL must be set!');
        const uri = Boolean(rawDest)
            ? `http://${this._baseAddress}/${rawDest}`
            : `http://${this._baseAddress}/${moduleName}/${actionName}`;
        debug(`Calling: ${uri}`);
        const rpcRequest = {
            from: this.name,
            to: moduleName,
            payload: params,
        }, options = {
            method: 'POST',
            uri,
            body: rpcRequest,
            json: true,
            timeout: this.timeout,
        };
        return this._requestMaker(options)
            .then((res) => {
            if (!res.isSuccess) {
                res.payload = this.$rebuildError(res.payload);
                if (res.payload instanceof common_1.InternalErrorException) {
                    return Promise.reject(res.payload);
                }
            }
            return res;
        })
            .catch((err) => {
            let ex;
            if (err.statusCode === 500) {
                ex = new common_1.InternalErrorException(err.message);
            }
            else {
                ex = new common_1.MinorException(err.message);
                ex.details = err;
            }
            return Promise.reject(ex);
        });
    }
    /**
     * @see IRpcCaller.callImpatient
     */
    callImpatient(options) {
        return new Promise((_, reject) => {
            this.call(options).catch(reject);
        });
    }
};
HttpRpcCaller = __decorate([
    common_1.decorators.injectable(),
    __param(0, common_1.decorators.inject(common_1.Types.CONFIG_PROVIDER)),
    __metadata("design:paramtypes", [Object])
], HttpRpcCaller);
exports.HttpRpcCaller = HttpRpcCaller;
//# sourceMappingURL=DirectRpcCaller.js.map