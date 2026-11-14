const AUTH_USERS_KEY = 'foodhub_users';
const AUTH_SESSION_KEY = 'foodhub_current_user';

function getUsers() {
    try {
        const raw = localStorage.getItem(AUTH_USERS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
    try {
        const localUser = localStorage.getItem(AUTH_SESSION_KEY);
        if (localUser) return JSON.parse(localUser);
        const sessionUser = sessionStorage.getItem(AUTH_SESSION_KEY);
        return sessionUser ? JSON.parse(sessionUser) : null;
    } catch {
        return null;
    }
}

function setCurrentUser(user, remember = true) {
    const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || ''
    };
    const serialized = JSON.stringify(safeUser);
    if (remember) {
        localStorage.setItem(AUTH_SESSION_KEY, serialized);
        sessionStorage.removeItem(AUTH_SESSION_KEY);
    } else {
        sessionStorage.setItem(AUTH_SESSION_KEY, serialized);
        localStorage.removeItem(AUTH_SESSION_KEY);
    }
}

function logoutUser() {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    if (typeof resetCart === 'function') {
        resetCart();
    }
    renderAuthNav();
    if (document.getElementById('loggedInCard')) {
        renderAuthPageState();
    }
}

function renderAuthNav() {
    const user = getCurrentUser();
    const menuAuthNotice = document.getElementById('menuAuthNotice');
    if (menuAuthNotice) {
        menuAuthNotice.classList.toggle('d-none', Boolean(user));
    }

    const authNavItem = document.getElementById('authNavItem');
    if (!authNavItem) return;

    authNavItem.innerHTML = '';

    if (user) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dropdown w-100';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn btn-auth-nav dropdown-toggle w-100 d-flex align-items-center justify-content-between justify-content-lg-center gap-1 mt-2 mt-lg-0';
        toggleBtn.setAttribute('data-bs-toggle', 'dropdown');
        toggleBtn.setAttribute('aria-expanded', 'false');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `👤 ${user.name}`;
        toggleBtn.appendChild(nameSpan);

        const menu = document.createElement('ul');
        menu.className = 'dropdown-menu dropdown-menu-end theme-dropdown-menu';

        const emailHeader = document.createElement('li');
        const emailSmall = document.createElement('span');
        emailSmall.className = 'dropdown-item-text text-muted small';
        emailSmall.textContent = user.email;
        emailHeader.appendChild(emailSmall);

        const divider = document.createElement('li');
        divider.innerHTML = '<hr class="dropdown-divider">';

        const logoutLi = document.createElement('li');
        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.className = 'dropdown-item text-danger';
        logoutBtn.textContent = 'ออกจากระบบ';
        logoutBtn.addEventListener('click', logoutUser);
        logoutLi.appendChild(logoutBtn);

        menu.appendChild(emailHeader);
        menu.appendChild(divider);
        menu.appendChild(logoutLi);

        wrapper.appendChild(toggleBtn);
        wrapper.appendChild(menu);
        authNavItem.appendChild(wrapper);
    } else {
        const loginLink = document.createElement('a');
        const isLoginPage = window.location.pathname.endsWith('login.html');
        loginLink.className = `btn btn-auth-nav w-100 mt-2 mt-lg-0${isLoginPage ? ' active' : ''}`;
        loginLink.href = './login.html';
        loginLink.textContent = 'เข้าสู่ระบบ / สมัครสมาชิก';
        authNavItem.appendChild(loginLink);
    }
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

function handleLogin(event) {
    event.preventDefault();
    clearAuthAlert();

    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const rememberInput = document.getElementById('rememberMe');

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!email || !password) {
        showAuthAlert('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
        return;
    }

    const users = getUsers();
    const matchedUser = users.find(
        u => u.email.toLowerCase() === email && u.password === password
    );

    if (!matchedUser) {
        const emailExists = users.some(u => u.email.toLowerCase() === email);
        if (!emailExists) {
            showAuthAlert('ไม่พบบัญชีอีเมลนี้ในระบบ กรุณาสมัครสมาชิกใหม่ก่อนเข้าสู่ระบบ');
        } else {
            showAuthAlert('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        }
        return;
    }

    setCurrentUser(matchedUser, rememberInput ? rememberInput.checked : true);
    renderAuthNav();
    showAuthAlert(`เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับคุณ ${matchedUser.name}`, 'success');

    setTimeout(() => {
        window.location.href = './index.html';
    }, 800);
}

function handleRegister(event) {
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAuthAlert('รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        return;
    }

    if (phone && !/^[0-9+\-\s]{9,15}$/.test(phone)) {
        showAuthAlert('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (เช่น 0812345678)');
        return;
    }

    if (password.length < 6) {
        showAuthAlert('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
        return;
    }

    if (password !== confirmPassword) {
        showAuthAlert('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
        return;
    }

    if (!acceptTerms) {
        showAuthAlert('กรุณายอมรับข้อกำหนดและเงื่อนไขการใช้งาน');
        return;
    }

    const users = getUsers();
    if (users.some(u => u.email.toLowerCase() === email)) {
        showAuthAlert('อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบหรือใช้อีเมลอื่น');
        return;
    }

    const newUser = {
        id: 'user_' + Date.now(),
        name,
        email,
        phone,
        password,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);
    setCurrentUser(newUser, true);
    renderAuthNav();

    showAuthAlert(`สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${name}`, 'success');

    setTimeout(() => {
        window.location.href = './index.html';
    }, 900);
}

function renderAuthPageState() {
    const authCardContent = document.getElementById('authFormsWrapper');
    const loggedInCard = document.getElementById('loggedInCard');
    const loggedInName = document.getElementById('loggedInUserName');
    const loggedInEmail = document.getElementById('loggedInUserEmail');

    if (!authCardContent || !loggedInCard) return;

    const user = getCurrentUser();
    if (user) {
        authCardContent.classList.add('d-none');
        loggedInCard.classList.remove('d-none');
        loggedInName.textContent = user.name;
        loggedInEmail.textContent = user.email;
    } else {
        loggedInCard.classList.add('d-none');
        authCardContent.classList.remove('d-none');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderAuthNav();

    if (document.getElementById('loginForm')) {
        renderAuthPageState();

        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        if (mode === 'register' || window.location.hash === '#register') {
            switchAuthMode('register');
        } else {
            switchAuthMode('login');
        }

        const regPassInput = document.getElementById('registerPassword');
        if (regPassInput) {
            regPassInput.addEventListener('input', (e) => {
                updatePasswordStrength(e.target.value);
            });
        }
    }
});
