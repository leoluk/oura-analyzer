import {css, html, LitElement, until} from 'https://cdn.jsdelivr.net/gh/lit/dist@2/all/lit-all.min.js';
import {OuraAPI} from './oura_api.js';

class OuraMain extends LitElement {
    static properties = {
        token: {type: String},

        fromDate: {type: String},
        toDate: {type: String},
    };

    constructor() {
        super();
        this.token = null;
        this.setDateFromToday(90);
    }

    setDateFromToday(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        this.fromDate = date.toISOString().split('T')[0];

        const today = new Date();
        today.setDate(today.getDate() + 1);
        this.toDate = today.toISOString().split('T')[0];
    }

    static styles = css`
      /* Display date selectors next to each other, but break
         * to a new line if the screen is too narrow. */

      .date-selectors {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
      }

      .date-selectors > * {
        margin-right: 1em;
        margin-bottom: 1em;
      }

      .range-selectors {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
      }

      .range-selectors > * {
        margin-right: 0.5em;
        margin-bottom: 0.5em;
      }
    `;

    renderUI() {
        return html`
            <h3>
                Select date range to request from API
            </h3>
            <div class="date-selectors">
                <sl-input
                        label="Start date" placeholder="Date" type="date"
                        value="${this.fromDate}"
                        @sl-change=${e => this.fromDate = e.target.value}></sl-input>
                <sl-input
                        label="End date" placeholder="Date" type="date"
                        value="${this.toDate}"
                        @sl-change=${e => this.toDate = e.target.value}></sl-input>
            </div>
            <div class="range-selectors">
                <sl-button @click=${() => this.setDateFromToday(356 * 5)}>Last 5y</sl-button>
                <sl-button @click=${() => this.setDateFromToday(356 * 2)}>Last 2y</sl-button>
                <sl-button @click=${() => this.setDateFromToday(356)}>Last 1y</sl-button>
                <sl-button @click=${() => this.setDateFromToday(90)}>Last 90d</sl-button>
                <sl-button @click=${() => this.setDateFromToday(30)}>Last 30d</sl-button>
                <sl-button @click=${() => this.setDateFromToday(7)}>Last 7d</sl-button>
            </div>
            ${until(this.renderSleepData(), html`
                <br/>
                <sl-spinner></sl-spinner>`)}
        `
    }

    parseShiftedTime(d) {
        const cutoff = 16; // TODO: one place

        let hours = d.getHours();
        if (hours > cutoff) {
            hours = hours - 24;
        }
        return hours + d.getMinutes() / 60;
    }

    async renderSleepData() {
        const api = new OuraAPI(this.token);
        const heartratePromise = this.fetchHeartRateData();
        const sleepData = await api.sleep(this.fromDate, this.toDate);

        const data = sleepData.data.map(d => {
            return {
                date: new Date(d.bedtime_start),
                bedtime_start_date: new Date(d.bedtime_start),
                bedtime_end_date: new Date(d.bedtime_end),
                bedtime_start_hour: this.parseShiftedTime(new Date(d.bedtime_start)),
                bedtime_end_hour: this.parseShiftedTime(new Date(d.bedtime_end)),
                readiness_score: d.readiness && d.readiness.score,
                temperature_deviation: d.readiness && d.readiness.temperature_deviation,
                temperature_trend_deviation: d.readiness && d.readiness.temperature_trend_deviation,
                ...d
            }
        }).filter(
            // The wraparound logic does not handle sleeps across dates - disregard day sleeps.
            d => d.type === 'long_sleep');

        return html`
            <h3>Sleep overview
                <sl-tag size="small">${sleepData.data.length} sleeps</sl-tag>
            </h3>

            <oura-sleep-graph .sleepData=${data} .heartrateData=${heartratePromise}></oura-sleep-graph>
        `
    }

    async fetchHeartRateData() {
        const api = new OuraAPI(this.token);
        // Convert to UTC ISO timestamp at 00:00:00
        const fromDatetime = new Date(this.fromDate).toISOString().split('T')[0] + 'T23:59:00Z';
        const toDatetime = new Date(this.toDate).toISOString().split('T')[0] + 'T00:00:00Z';

        const heartRateData = await api.heartrate(fromDatetime, toDatetime);

        return heartRateData.data.map(d => {
            return {
                date: new Date(d.timestamp),
                ...d
            }
        });
    }

    render() {
        return html`
            <oura-login @token-changed=${e => this.token = e.detail.token}></oura-login>
            <p></p>
            ${this.token ? this.renderUI() : ''}
        `;
    }
}

customElements.define('oura-main', OuraMain);
