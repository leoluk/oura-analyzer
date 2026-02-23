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

    async _getPaginated(path) {
        let allData = [];
        let url = path;
        while (true) {
            const req = await this._get(url);
            allData = allData.concat(req.data);
            if (!req.next_token) {
                return {data: allData};
            }
            const separator = url.includes('?') ? '&' : '?';
            url = `${path}${separator}next_token=${req.next_token}`;
        }
    }

    async sleep(start_date, end_date) {
        return await this._getPaginated(`usercollection/sleep?start_date=${start_date}&end_date=${end_date}`);
    }

    async heartrate(start_datetime, end_datetime) {
        return await this._getPaginated(`usercollection/heartrate?start_datetime=${start_datetime}&end_datetime=${end_datetime}`);
    }

    async dailyActivity(start_date, end_date) {
        return await this._getPaginated(`usercollection/daily_activity?start_date=${start_date}&end_date=${end_date}`);
    }
}
