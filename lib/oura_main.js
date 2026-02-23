import {cache, css, html, LitElement} from 'https://cdn.jsdelivr.net/gh/lit/dist@2/all/lit-all.min.js';
import {OuraAPI} from './oura_api.js';

class OuraMain extends LitElement {
    static properties = {
        token: {type: String},

        fromDate: {type: String},
        toDate: {type: String},
        requestDaytimeHR: {type: Boolean},

        _sleepData: {state: true},
        _loading: {state: true},
    };

    constructor() {
        super();
        this.token = null;
        this.requestDaytimeHR = false;
        this._sleepData = null;
        this._loading = false;
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

    willUpdate(changed) {
        if (changed.has('fromDate') || changed.has('toDate') || changed.has('requestDaytimeHR') || changed.has('token')) {
            if (this.token) {
                this._fetchSleepData();
            }
        }
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
                <sl-button @click=${() => this.setDateFromToday(356 * 10)}>Last 10y</sl-button>
                <sl-button @click=${() => this.setDateFromToday(356 * 5)}>Last 5y</sl-button>
                <sl-button @click=${() => this.setDateFromToday(356 * 2)}>Last 2y</sl-button>
                <sl-button @click=${() => this.setDateFromToday(356)}>Last 1y</sl-button>
                <sl-button @click=${() => this.setDateFromToday(90)}>Last 90d</sl-button>
                <sl-button @click=${() => this.setDateFromToday(30)}>Last 30d</sl-button>
                <sl-button @click=${() => this.setDateFromToday(7)}>Last 7d</sl-button>
            </div>
            <sl-checkbox
                    @sl-change=${(e) => { this.requestDaytimeHR = e.target.checked }}
                    .checked=${this.requestDaytimeHR}
                    style="margin-bottom: 1em;">
                Request daytime heart rate (slow)
            </sl-checkbox>
            ${cache(this._sleepData ? html`
                <h3>Sleep overview
                    <sl-tag size="small">${this._sleepData.length} sleeps</sl-tag>
                    ${this._loading ? html` <sl-spinner></sl-spinner>` : ''}
                </h3>
                <oura-sleep-graph .sleepData=${this._sleepData} .hasHrData=${this.requestDaytimeHR}></oura-sleep-graph>
            ` : html`
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

    async _fetchWeightData() {
        const weightByDay = new Map();

        // Withings data (comma-separated, dates as YYYY-MM-DD HH:MM:SS, values in kg)
        try {
            const resp = await fetch('data_LEO_1771869311/weight.csv');
            if (resp.ok) {
                const text = await resp.text();
                for (const line of text.trim().split('\n').slice(1)) {
                    const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
                    const day = cols[0].slice(0, 10);
                    if (weightByDay.has(day)) continue;
                    weightByDay.set(day, {
                        weight: cols[1] ? parseFloat(cols[1]) : null,
                        fat_mass: cols[2] ? parseFloat(cols[2]) : null,
                        bone_mass: cols[3] ? parseFloat(cols[3]) : null,
                        muscle_mass: cols[4] ? parseFloat(cols[4]) : null,
                        hydration: cols[5] ? parseFloat(cols[5]) : null,
                    });
                }
            }
        } catch (e) {
            console.warn('Could not load Withings weight data:', e);
        }

        // Beurer data (semicolon-separated, dates as DD.MM.YYYY, body comp as percentages)
        for (const file of ['beurer/HealthManagerApp_DataExport-1.csv', 'beurer/HealthManagerApp_DataExport-2.csv']) {
            try {
                const resp = await fetch(file);
                if (!resp.ok) continue;
                const text = await resp.text();
                const dataStart = text.indexOf('Date;Time;kg;');
                if (dataStart === -1) continue;
                const lines = text.slice(dataStart).trim().split('\n').slice(1);
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const cols = line.split(';').map(c => c.replace(/"/g, '').trim());
                    // Date is DD.MM.YYYY -> YYYY-MM-DD
                    const [dd, mm, yyyy] = cols[0].split('.');
                    const day = `${yyyy}-${mm}-${dd}`;
                    if (weightByDay.has(day)) continue;
                    const kg = cols[2] ? parseFloat(cols[2]) : null;
                    const fatPct = cols[4] ? parseFloat(cols[4]) : null;
                    const waterPct = cols[5] ? parseFloat(cols[5]) : null;
                    const musclePct = cols[6] ? parseFloat(cols[6]) : null;
                    const bonePct = cols[7] ? parseFloat(cols[7]) : null;
                    weightByDay.set(day, {
                        weight: kg,
                        fat_mass: kg && fatPct ? Math.round(kg * fatPct / 100 * 100) / 100 : null,
                        bone_mass: kg && bonePct ? Math.round(kg * bonePct / 100 * 100) / 100 : null,
                        muscle_mass: kg && musclePct ? Math.round(kg * musclePct / 100 * 100) / 100 : null,
                        hydration: kg && waterPct ? Math.round(kg * waterPct / 100 * 100) / 100 : null,
                    });
                }
            } catch (e) {
                console.warn(`Could not load Beurer weight data (${file}):`, e);
            }
        }

        return weightByDay;
    }

    async _fetchSleepData() {
        this._loading = true;
        try {
            const api = new OuraAPI(this.token);
            const fetches = [
                api.sleep(this.fromDate, this.toDate),
                api.dailyActivity(this.fromDate, this.toDate),
                api.dailySpo2(this.fromDate, this.toDate),
                api.dailyStress(this.fromDate, this.toDate),
                api.vo2Max(this.fromDate, this.toDate),
                api.workouts(this.fromDate, this.toDate),
                this.requestDaytimeHR
                    ? api.heartrate(this.fromDate, this.toDate).catch(() => ({data: []}))
                    : Promise.resolve({data: []}),
                this._fetchWeightData(),
            ];
            const [sleepData, activityData, spo2Data, stressData, vo2Data, workoutData, hrData, weightByDay] = await Promise.all(fetches);

            const activityByDay = new Map();
            for (const a of activityData.data) {
                activityByDay.set(a.day, a);
            }

            const spo2ByDay = new Map();
            for (const s of spo2Data.data) {
                spo2ByDay.set(s.day, s);
            }

            const stressByDay = new Map();
            for (const s of stressData.data) {
                stressByDay.set(s.day, s);
            }

            const vo2ByDay = new Map();
            for (const v of vo2Data.data) {
                vo2ByDay.set(v.day, v);
            }

            // Aggregate workouts per day
            const workoutsByDay = new Map();
            for (const w of workoutData.data) {
                if (!workoutsByDay.has(w.day)) {
                    workoutsByDay.set(w.day, []);
                }
                workoutsByDay.get(w.day).push(w);
            }

            // Compute daily average heart rate from time-series data
            const hrByDay = new Map();
            for (const h of hrData.data) {
                const day = h.timestamp.slice(0, 10);
                if (!hrByDay.has(day)) {
                    hrByDay.set(day, {sum: 0, count: 0});
                }
                const acc = hrByDay.get(day);
                acc.sum += h.bpm;
                acc.count++;
            }

            this._sleepData = sleepData.data.map(d => {
                const activity = activityByDay.get(d.day) || {};
                const spo2 = spo2ByDay.get(d.day) || {};
                const stress = stressByDay.get(d.day) || {};
                const vo2 = vo2ByDay.get(d.day) || {};
                const dayWorkouts = workoutsByDay.get(d.day) || [];
                const hrAcc = hrByDay.get(d.day);
                const weightData = weightByDay.get(d.day) || {};

                let workout_duration = 0;
                for (const w of dayWorkouts) {
                    if (w.start_datetime && w.end_datetime) {
                        workout_duration += (new Date(w.end_datetime) - new Date(w.start_datetime)) / 1000;
                    }
                }

                return {
                    date: new Date(d.bedtime_start),
                    bedtime_start_date: new Date(d.bedtime_start),
                    bedtime_end_date: new Date(d.bedtime_end),
                    bedtime_start_hour: this.parseShiftedTime(new Date(d.bedtime_start)),
                    bedtime_end_hour: this.parseShiftedTime(new Date(d.bedtime_end)),
                    readiness_score: d.readiness && d.readiness.score,
                    temperature_deviation: d.readiness && d.readiness.temperature_deviation,
                    temperature_trend_deviation: d.readiness && d.readiness.temperature_trend_deviation,
                    // Activity
                    steps: activity.steps,
                    active_calories: activity.active_calories,
                    total_calories: activity.total_calories,
                    activity_score: activity.score,
                    equivalent_walking_distance: activity.equivalent_walking_distance,
                    high_activity_time: activity.high_activity_time,
                    medium_activity_time: activity.medium_activity_time,
                    low_activity_time: activity.low_activity_time,
                    sedentary_time: activity.sedentary_time,
                    resting_time: activity.resting_time,
                    // SpO2
                    spo2_average: (spo2.spo2_percentage && spo2.spo2_percentage.average) || null,
                    breathing_disturbance_index: spo2.breathing_disturbance_index || null,
                    // Stress
                    stress_high: stress.stress_high,
                    recovery_high: stress.recovery_high,
                    // VO2 Max
                    vo2_max: vo2.vo2_max,
                    // Heart rate (all-day)
                    hr_daily_average: hrAcc ? Math.round(hrAcc.sum / hrAcc.count) : null,
                    // Workouts
                    workout_count: dayWorkouts.length || null,
                    workout_duration: workout_duration || null,
                    // Body
                    weight: weightData.weight || null,
                    fat_mass: weightData.fat_mass || null,
                    bone_mass: weightData.bone_mass || null,
                    muscle_mass: weightData.muscle_mass || null,
                    hydration: weightData.hydration || null,
                    ...d
                }
            }).filter(
                // The wraparound logic does not handle sleeps across dates - disregard day sleeps.
                d => d.type === 'long_sleep');
        } finally {
            this._loading = false;
        }
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
