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
const request = require("request-promise");
const back_lib_common_util_1 = require("back-lib-common-util");
const rpc = require("./RpcCommon");
let HttpRpcCaller = class HttpRpcCaller extends rpc.RpcCallerBase {
    constructor() {
        super();
        this._requestMaker = request;
    }
    get baseAddress() {
        return this._baseAddress;
    }
    set baseAddress(val) {
        this._baseAddress = val;
    }
    init(param) {
    }
    call(moduleName, action, params) {
        back_lib_common_util_1.Guard.assertDefined('moduleName', moduleName);
        back_lib_common_util_1.Guard.assertDefined('action', action);
        back_lib_common_util_1.Guard.assertIsTruthy(this._baseAddress, 'Base URL must be set!');
        return new Promise((resolve, reject) => {
            let request = {
                from: this._name,
                to: moduleName,
                params
            }, options = {
                method: 'POST',
                uri: `http://${this._baseAddress}/${moduleName}/${action}`,
                body: request,
                json: true // Automatically stringifies the body to JSON
            };
            return this._requestMaker(options)
                .catch(rawResponse => {
                return rawResponse.error;
            });
        });
    }
};
HttpRpcCaller = __decorate([
    back_lib_common_util_1.injectable(),
    __metadata("design:paramtypes", [])
], HttpRpcCaller);
exports.HttpRpcCaller = HttpRpcCaller;

//# sourceMappingURL=DirectRpcCaller.js.map
