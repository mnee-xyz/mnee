import { MNEEService } from "./mneeService.js";
export default class Mnee {
    service;
    constructor(apiToken) {
        this.service = new MNEEService(apiToken);
    }
    async balance(address) {
        return this.service.getBalance(address);
    }
    async transfer(request, wif) {
        return this.service.transfer(request, wif);
    }
}
//# sourceMappingURL=index.js.map