import {html, css, LitElement, until} from 'https://cdn.jsdelivr.net/gh/lit/dist@2/all/lit-all.min.js';
import {OuraAPI} from './oura_api.js';

const clientId = 'JEED62QPO3SB2BYQ';

class OuraLogin extends LitElement {
    static properties = {
        token: {type: String},
        api: {type: Object},
        error: {type: String},
    };

    constructor() {
        super();
        const token = localStorage.getItem('oura-token');
        if (token) {
            this.setToken(token);
        }
    };

    setToken(token) {
        this.token = token;
        this.dispatchEvent(new CustomEvent('token-changed',
            {detail: {token}, bubbles: true, composed: true}));
        localStorage.setItem('oura-token', token);
        this.api = new OuraAPI(token);
    }

    clearToken() {
        this.token = null;
        this.dispatchEvent(new CustomEvent('token-changed',
            {detail: {token: null}, bubbles: true, composed: true}));
        localStorage.removeItem('oura-token');
    }

    async firstUpdated() {
        const url = new URL(window.location.href);
        // Check for access token
        if (url.hash) {
            const params = new URLSearchParams(url.hash.slice(1));
            if (params.has('access_token')) {
                this.setToken(params.get('access_token'));
                history.replaceState(null, null, ' ');
            }
        }
    }

    redirectUrl() {
        const url = new URL(window.location.href);
        return `https://cloud.ouraring.com/oauth/authorize?client_id=${clientId}&redirect_uri=${url.origin + url.pathname}&response_type=token`;
    }

    static styles = css`
      .login {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
      }
    `

    async status() {
        const logout = (msg) => html`
            <sl-button @click=${this.clearToken}>${msg}</sl-button>`;

        try {
            const info = await this.api.personalInfo();
            return html`
                <div class="login">
                    <div>
                        You are logged in as <i>${info.email}</i>.
                    </div>
                    ${logout("Logout")}
                </div>
            `;

        } catch (e) {
            console.log(e);

            // Catch Unauthorized errors and simply clear the token
            if (e.message.startsWith("Error 401:")) {
                console.log("Unauthorized, clearing token");
                this.clearToken();
            }

            return html`
                <p>
                    <sl-alert open variant="danger">
                        <sl-icon name="exclamation-octagon" slot="icon"></sl-icon>
                        <strong>Failed to check login status</strong><br/>
                        ${e.message}
                    </sl-alert>
                </p>
                <p>
                    ${logout("Log out and try again")}
                </p>
            `;
        }
    }

    render() {
        if (this.token) {
            return html`${until(this.status(), html`
                <sl-spinner></sl-spinner>`)}</p>`;
        } else {
            return html`
                <sl-button href="${this.redirectUrl()}">Log in to Oura via OAuth</sl-button>
            `;
        }
    };
}

customElements.define('oura-login', OuraLogin);
