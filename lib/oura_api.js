// See cf-proxy-worker.js for the CloudFlare worker code.
const apiRoot = "https://oura-cors-proxy.b1.workers.dev"

export class OuraAPI {
    constructor(accessToken) {
        this.accessToken = accessToken;
    }

    async _get(path) {
        const request = new Request(`${apiRoot}/v2/${path}`, {
            headers: {
                "Authorization": `Bearer ${this.accessToken}`,
                "Cache-Control": "no-cache",
            }
        });
        const response = await fetch(request);
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
    }

    async personalInfo() {
        return await this._get('usercollection/personal_info');
    }

    async sleep(start_date, end_date) {
        const req = await this._get(`usercollection/sleep?start_date=${start_date}&end_date=${end_date}`);
        if (req.next_token !== null) {
            throw new Error("Pagination not implemented, please create issue on GitHub");
        }
        return req;
    }

    async heartrate(start_datetime, end_datetime) {
        const req = await this._get(`usercollection/heartrate?start_datetime=${start_datetime}&end_datetime=${end_datetime}`);
        if (req.next_token !== null) {
            throw new Error("Pagination not implemented, please create issue on GitHub");
        }
        return req;
    }
}
