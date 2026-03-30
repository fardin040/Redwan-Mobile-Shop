// ==========================================================
// js/account.js - User Account Authentication Flow
// ==========================================================

let currentRegistrationPhone = null;

// Ensure state is right when page loads
document.addEventListener("DOMContentLoaded", async () => {
    // Override default auth behavior to prevent redirects
    if (localStorage.getItem('accessToken')) {
        await showProfile();
    }
});

/**
 * Handle UI tabs
 */
window.switchTab = function(tab) {
    document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', i === (tab === 'login' ? 0 : 1)));
    document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('otpSection').classList.remove('show');
    document.getElementById(tab === 'login' ? 'loginPanel' : 'registerPanel').classList.add('active');
};

window.togglePass = function(id, btn) {
    const inp = document.getElementById(id);
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁️' : '🔒';
};

window.checkStrength = function(v) {
    const bars = [document.getElementById('sb1'), document.getElementById('sb2'), document.getElementById('sb3'), document.getElementById('sb4')];
    const lbl = document.getElementById('strengthLabel');
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;

    const colors = ['#e8132a','#f97316','#f5c842','#22c55e'];
    const labels = ['Weak','Fair','Good','Strong'];

    bars.forEach((b,i) => { b.style.background = i < score ? colors[score-1] : 'var(--card2)'; });
    lbl.textContent = score > 0 ? labels[score-1] : 'Enter a password';
    lbl.style.color = score > 0 ? colors[score-1] : 'var(--muted)';
};

// ==========================================================
// Authentication Logic
// ==========================================================

window.doLogin = async function() {
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPass').value;
    const btn = event.currentTarget;
    const origHTML = btn.innerHTML;

    if (!identifier || !password) {
        alert("Please enter both identifier (email/phone) and password.");
        return;
    }

    try {
        btn.innerHTML = `<span style="opacity:0.7">Working...</span>`;
        const result = await window.API.post('/auth/login', { identifier, password });
        
        if (result.success) {
            localStorage.setItem('accessToken', result.data.accessToken);
            localStorage.setItem('refreshToken', result.data.refreshToken);
            
            // Re-sync global auth variable
            if (Auth) await Auth.init();
            
            await showProfile();
        }
    } catch (e) {
        alert(e.message || "Failed to sign in.");
    } finally {
        btn.innerHTML = origHTML;
    }
};

window.doRegister = async function() {
    const name = (document.getElementById('regFirstName').value.trim() || '') + ' ' + (document.getElementById('regLastName').value.trim() || '');
    const phone = document.getElementById('regPhone').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;
    
    if (name.length < 3 || !phone || password.length < 6) {
        alert("Please fill out Name, Phone, and Password (min 6 chars).");
        return;
    }
    if (!/^\+?880[0-9]{10}$/.test(phone)) {
        alert("Please enter a valid BD phone number (+880...)");
        return;
    }

    const btn = event.currentTarget;
    const origHTML = btn.innerHTML;
    try {
        btn.innerHTML = `<span style="opacity:0.7">Verifying...</span>`;
        // Register user immediately - note we require phone verification for complete security natively via OTP endpoint
        const result = await window.API.post('/auth/register', { name: name.trim(), phone, email, password });
        
        if (result.success) {
            localStorage.setItem('accessToken', result.data.accessToken);
            localStorage.setItem('refreshToken', result.data.refreshToken);
            
            if (window.Auth) await window.Auth.init();
            
            await showProfile();
        }
    } catch (e) {
        alert(e.message || "Failed to create account.");
    } finally {
        btn.innerHTML = origHTML;
    }
};

// ==========================================================
// OTP Workflow
// ==========================================================
let otpTimerInterval;

window.showOTP = async function(e) {
    e.preventDefault();
    const phone = prompt("Enter your phone number (+880...) to receive OTP reset.", "+8801700000000");
    if(!phone) return;
    
    try {
        const result = await window.API.post('/auth/send-otp', { phone });
        currentRegistrationPhone = phone;
        showOTPSection(phone);
        // If SMS is unavailable, show the OTP to the user for testing
        if (result.otp) {
            setTimeout(() => {
                alert(`📱 SMS unavailable. Your test OTP is: ${result.otp}\n\nThis would normally be sent via SMS.`);
            }, 300);
        }
    } catch (e) {
        alert(e.message || "Failed to send OTP");
    }
};

function showOTPSection(phoneLabel) {
    document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
    const section = document.getElementById('otpSection');
    section.innerHTML = section.innerHTML.replace('+880 1700-000000', phoneLabel);
    section.classList.add('show');
    startTimer();
}

window.hideOTP = function(e) {
    e.preventDefault();
    document.getElementById('otpSection').classList.remove('show');
    document.getElementById('loginPanel').classList.add('active');
};

window.startTimer = function() {
    let t = 60;
    const el = document.getElementById('timer');
    const btn = document.getElementById('resendBtn');
    if(!el || !btn) return;
    
    if (otpTimerInterval) clearInterval(otpTimerInterval);
    
    btn.onclick = null; // Unbind
    btn.style.cursor = 'default';
    btn.style.opacity = '0.5';

    otpTimerInterval = setInterval(() => {
        el.textContent = --t;
        if (t <= 0) {
            clearInterval(otpTimerInterval);
            btn.innerHTML = 'Resend OTP';
            btn.style.cursor = 'pointer';
            btn.style.opacity = '1';
            btn.onclick = async (e) => {
                e.preventDefault();
                await window.API.post('/auth/send-otp', { phone: currentRegistrationPhone });
                startTimer();
            }
            el.textContent = '';
        }
    }, 1000);
};

window.moveNext = function(el, idx) {
    const inputs = document.querySelectorAll('.otp-input');
    if (el.value.length === 1 && idx < 6) inputs[idx].focus();
};

window.verifyOTP = async function() {
    const inputs = document.querySelectorAll('.otp-input');
    const code = Array.from(inputs).map(i => i.value).join('');
    
    if (code.length !== 6) {
        alert('Please enter the 6-digit OTP');
        return;
    }

    try {
        const result = await window.API.post('/auth/verify-otp', { phone: currentRegistrationPhone, otp: code });
        if (result.success) {
            localStorage.setItem('accessToken', result.data.accessToken);
            localStorage.setItem('refreshToken', result.data.refreshToken);
            
            if (Auth) await Auth.init();
            
            await showProfile();
        }
    } catch (e) {
        alert(e.message || "OTP Verification failed");
    }
};

// ==========================================================
// Profile View
// ==========================================================

window.showProfile = async function() {
    try {
        const result = await window.API.get('/auth/me');
        if (result.success && result.data) {
            const user = result.data;
            document.getElementById('authPanel').style.display = 'none';
            document.getElementById('profileView').classList.add('show');
            
            document.querySelector('.profile-name').textContent = user.name;
            document.querySelector('.profile-email').textContent = `${user.email || 'No email provided'} · ${user.phone}`;
            document.querySelector('.profile-avatar').innerHTML = `${user.name.charAt(0).toUpperCase()}<div class="edit-overlay">✏️</div>`;
            
            if (user.is_verified) {
                document.querySelector('.profile-badge').textContent = '✓ Verified Customer';
            } else {
                document.querySelector('.profile-badge').textContent = 'Unverified Phone';
            }
            
            // Populate settings inputs
            const inputs = document.querySelectorAll('.profile-view .form-input');
            if(inputs.length >= 4) {
               inputs[0].value = user.name.split(' ')[0] || '';
               inputs[1].value = user.name.split(' ').slice(1).join(' ') || '';
               inputs[2].value = user.phone || '';
               inputs[3].value = user.email || '';
            }
        }
    } catch(e) {
        console.error("Profile load failed", e);
    }
};

window.saveProfile = async function() {
    const btn = event.currentTarget;
    const inputs = document.querySelectorAll('.profile-view .form-input');
    const name = inputs[0].value + ' ' + inputs[1].value;
    const email = inputs[3].value;
    
    btn.textContent = 'Verifying...';
    try {
        await window.API.put('/auth/profile', { name, email });
        btn.textContent = '✓ Saved!';
        btn.style.background = '#22c55e';
        showProfile();
    } catch (e) {
        btn.textContent = 'Error';
    } finally {
        setTimeout(()=>{
            btn.textContent = '💾 Save Changes';
            btn.style.background = '';
        }, 2000);
    }
};

window.doLogout = function() {
    if (Auth) Auth.logout();
    document.getElementById('authPanel').style.display = 'block';
    document.getElementById('profileView').classList.remove('show');
    switchTab('login');
};
