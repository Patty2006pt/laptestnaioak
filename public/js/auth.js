function getCurrentUser() {
    return window.__FOODHUB_USER__ || null;
}

function setCurrentUserState(user) {
    window.__FOODHUB_USER__ = user || null;
    const menuAuthNotice = document.getElementById('menuAuthNotice');
    if (menuAuthNotice) {
        menuAuthNotice.classList.toggle('d-none', Boolean(user));
    }
}

async function logoutUser() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
        console.error('Logout failed:', err);
    }
    setCurrentUserState(null);
    window.location.href = '/login';
}

function showAuthAlert(message, type = 'danger') {
    const alertBox = document.getElementById('authAlert');
    if (!alertBox) return;

    alertBox.className = `alert alert-${type} rounded-3 py-2 px-3 small mb-3`;
    alertBox.textContent = message;
    alertBox.classList.remove('d-none');
}

function clearAuthAlert() {
    const alertBox = document.getElementById('authAlert');
    if (!alertBox) return;
    alertBox.classList.add('d-none');
    alertBox.textContent = '';
}

function switchAuthMode(mode) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTabBtn = document.getElementById('loginTabBtn');
    const registerTabBtn = document.getElementById('registerTabBtn');
    const authHeading = document.getElementById('authHeading');
    const authSubheading = document.getElementById('authSubheading');

    if (!loginForm || !registerForm) return;

    clearAuthAlert();

    if (mode === 'register') {
        loginForm.classList.add('d-none');
        registerForm.classList.remove('d-none');
        loginTabBtn.classList.remove('active');
        registerTabBtn.classList.add('active');
        authHeading.textContent = 'สมัครสมาชิกใหม่';
        authSubheading.textContent = 'สร้างบัญชี Food Hub เพื่อสั่งอาหารและรับสิทธิพิเศษ';
    } else {
        registerForm.classList.add('d-none');
        loginForm.classList.remove('d-none');
        registerTabBtn.classList.remove('active');
        loginTabBtn.classList.add('active');
        authHeading.textContent = 'ยินดีต้อนรับกลับมา';
        authSubheading.textContent = 'เข้าสู่ระบบเพื่อสั่งอาหารจานโปรดของคุณ';
    }
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.textContent = isHidden ? '🙈' : '👁️';
    btn.setAttribute('aria-label', isHidden ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
}

function updatePasswordStrength(password) {
    const bar = document.getElementById('passwordStrengthFill');
    const hint = document.getElementById('passwordStrengthText');
    if (!bar || !hint) return;

    if (!password) {
        bar.style.width = '0%';
        bar.style.backgroundColor = 'transparent';
        hint.textContent = 'ใช้รหัสผ่านอย่างน้อย 6 ตัวอักษร';
        hint.className = 'text-muted small d-block mt-1';
        return;
    }

    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

    if (password.length < 6) {
        bar.style.width = '25%';
        bar.style.backgroundColor = '#dc3545';
        hint.textContent = 'สั้นเกินไป (ต้องมีอย่างน้อย 6 ตัวอักษร)';
        hint.className = 'text-danger small d-block mt-1';
    } else if (score <= 2) {
        bar.style.width = '55%';
        bar.style.backgroundColor = '#f5a623';
        hint.textContent = 'ความปลอดภัยปานกลาง';
        hint.className = 'text-warning-emphasis small d-block mt-1';
    } else {
        bar.style.width = '100%';
        bar.style.backgroundColor = '#2e6f40';
        hint.textContent = 'รหัสผ่านปลอดภัยดีมาก';
        hint.className = 'text-success small d-block mt-1';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    clearAuthAlert();

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const rememberInput = document.getElementById('rememberMe');

    if (!email || !password) {
        showAuthAlert('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
        return;
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                remember: rememberInput ? rememberInput.checked : true
            })
        });
        const data = await res.json();

        if (!res.ok) {
            showAuthAlert(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
            return;
        }

        setCurrentUserState(data.user);
        showAuthAlert(data.message || `เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับคุณ ${data.user.name}`, 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 600);
    } catch {
        showAuthAlert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    clearAuthAlert();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim().toLowerCase();
    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const acceptTerms = document.getElementById('acceptTerms').checked;

    if (!name || !email || !password || !confirmPassword) {
        showAuthAlert('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
        return;
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                email,
                phone,
                password,
                confirmPassword,
                acceptTerms
            })
        });
        const data = await res.json();

        if (!res.ok) {
            showAuthAlert(data.error || 'สมัครสมาชิกไม่สำเร็จ');
            return;
        }

        setCurrentUserState(data.user);
        showAuthAlert(data.message || `สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${name}`, 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 700);
    } catch {
        showAuthAlert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const regPassInput = document.getElementById('registerPassword');
    if (regPassInput) {
        regPassInput.addEventListener('input', (e) => {
            updatePasswordStrength(e.target.value);
        });
    }
});
