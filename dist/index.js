import { MNEEService } from "./mneeService.js";
export * from "./mnee.types.js";
export default class Mnee {
    service;
    constructor(apiToken) {
        this.service = new MNEEService(apiToken);
    }
    toAtomicAmount(amount, decimals) {
        return this.service.toAtomicAmount(amount, decimals);
    }
    async config() {
        return this.service.getConfig();
    }
    async balance(address) {
        return this.service.getBalance(address);
    }
    async transfer(request, wif) {
        return this.service.transfer(request, wif);
    }
}
//# sourceMappingURL=index.js.map