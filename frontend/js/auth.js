// ==========================================================
// js/auth.js - Authentication State and UI Management
// ==========================================================

const Auth = {
    user: null,

    // Run on every page load — returns true if authenticated
    async init() {
        const loginBtnObj = document.querySelector('.btn-login');
        if (loginBtnObj) {
            loginBtnObj.onclick = () => window.location.href = "account.html";
        }
        return await this.checkAuthStatus();
    },

    /**
     * Inspects localStorage to determine if user is logged in.
     * Returns true if authenticated, false otherwise.
     */
    async checkAuthStatus() {
        const token = localStorage.getItem('accessToken');
        const loginBtnObj = document.querySelector('.btn-login');

        if (!token) {
            this.user = null;
            if (loginBtnObj) {
                loginBtnObj.textContent = "Sign In";
                loginBtnObj.onclick = () => window.location.href = "account.html";
            }
            return false;
        }

        // Try getting user profile
        try {
            const result = await window.API.get('/auth/me');
            if (result && result.success && result.data) {
                this.user = result.data;
                if (loginBtnObj) {
                    const firstName = (this.user.name || 'Account').split(' ')[0];
                    loginBtnObj.textContent = `Hi, ${firstName}`;
                    loginBtnObj.onclick = () => window.location.href = "account.html";
                }
                return true;
            } else {
                throw new Error("Invalid session token");
            }
        } catch (error) {
            console.error('[Auth] Session check notice:', error.message);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            this.user = null;
            if (loginBtnObj) {
                loginBtnObj.textContent = "Sign In";
                loginBtnObj.onclick = () => window.location.href = "account.html";
            }
            return false;
        }
    },

    /**
     * Full logout — clears session and redirects to account page
     */
    logout() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        this.user = null;
        window.location.href = 'account.html';
    }
};

window.Auth = Auth;
