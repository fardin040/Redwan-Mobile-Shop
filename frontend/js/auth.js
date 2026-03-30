// ==========================================================
// js/auth.js - Authentication State and UI Management
// ==========================================================

const Auth = {
    user: null,

    // Run on every page load — returns true if authenticated
    async init() {
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
                loginBtnObj.onclick = () => window.location.href = "/account.html";
            }
            return false;
        }

        // Try getting user profile
        try {
            const result = await window.API.get('/auth/me');
            if (result.success) {
                this.user = result.data;
                if (loginBtnObj) {
                    loginBtnObj.textContent = `Hi, ${this.user.name.split(' ')[0]}`;
                    loginBtnObj.onclick = () => window.location.href = "/account.html";
                }
                return true;
            } else {
                throw new Error("Invalid token");
            }
        } catch (error) {
            console.error('[Auth] Session check failed:', error.message);
            // Clear invalid tokens but do NOT reload — let the caller handle the redirect
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            this.user = null;
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
        window.location.href = '/account.html';
    }
};

window.Auth = Auth;
