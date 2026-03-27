// ==========================================================
// js/auth.js - Authentication State and UI Management
// ==========================================================

const Auth = {
    user: null,

    // Run on every page load
    init() {
        this.checkAuthStatus();
    },

    /**
     * Inspects localStorage to determine if user is logged in
     */
    async checkAuthStatus() {
        const token = localStorage.getItem('accessToken');
        const loginBtnObj = document.querySelector('.btn-login');

        if (!token) {
            // Not logged in
            this.user = null;
            if (loginBtnObj) {
                loginBtnObj.textContent = "Sign In";
                loginBtnObj.onclick = () => window.location.href = "/account.html";
            }
            return;
        }

        // Try getting user profile
        try {
            const result = await window.API.get('/auth/me');
            if (result.success) {
                this.user = result.data;
                // Update navigation button
                if (loginBtnObj) {
                    loginBtnObj.textContent = `Hi, ${this.user.name.split(' ')[0]}`;
                    loginBtnObj.onclick = () => window.location.href = "/account.html";
                }
            } else {
                throw new Error("Invalid token");
            }
        } catch (error) {
            console.error(error);
            this.logout();
        }
    },

    /**
     * Logout and destroy session
     */
    logout() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        this.user = null;
        window.location.reload();
    }
};

window.logoutUser = () => Auth.logout();

// Trigger on load
document.addEventListener("DOMContentLoaded", () => {
    Auth.init();
});
