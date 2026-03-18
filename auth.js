/**
 * auth.js — SprintFlo Authentication Module
 * Handles: Login, Signup, Admin Approval Check, Logout, Password Reset
 * Uses: Supabase Auth + custom "users" table (id, email, full_name, is_approved, created_at)
 */

console.log('Auth module loaded');

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */

/**
 * Display a message banner inside the auth card.
 * @param {string} html  - Message HTML
 * @param {'error'|'success'|'pending'} type
 */
function showAuthMessage(html, type = 'error') {
  let el = document.getElementById('auth-message');
  if (!el) {
    el = document.createElement('div');
    el.id = 'auth-message';
    document.querySelector('.a-card').appendChild(el);
  }
  el.className = 'auth-msg auth-msg--' + type;
  el.innerHTML = html;
  el.style.display = 'flex';

  // Auto-dismiss non-pending messages after 7 s
  if (type !== 'pending') {
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 7000);
  }
}

function hideAuthMessage() {
  const el = document.getElementById('auth-message');
  if (el) el.style.display = 'none';
}

/** Toggle button loading state */
function setBtnLoading(btnId, on) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.classList.toggle('loading', on);
  btn.disabled = on;
}

/** Simple email format validator */
function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

/** Map Supabase error messages to user-friendly strings */
function mapAuthError(msg) {
  if (!msg) return 'An unexpected error occurred.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials'))
    return 'Incorrect email or password. Please try again.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'An account with this email already exists. Try signing in instead.';
  if (m.includes('user not found'))
    return 'No account found with that email address.';
  if (m.includes('email not confirmed'))
    return 'Please confirm your email address before signing in.';
  if (m.includes('too many') || m.includes('rate limit'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Network error. Check your connection and try again.';
  if (m.includes('password') && m.includes('character'))
    return 'Password must be at least 8 characters.';
  return msg;
}

/* ══════════════════════════════════════════════════════════
   TAB SWITCHER
══════════════════════════════════════════════════════════ */

window.switchTab = function (tab) {
  const isLogin = tab === 'login';
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-signup').classList.toggle('active', !isLogin);
  document.getElementById('panel-login').classList.toggle('active', isLogin);
  document.getElementById('panel-signup').classList.toggle('active', !isLogin);

  const h = document.getElementById('auth-heading');
  const f = document.getElementById('auth-footer-note');
  if (isLogin) {
    h.querySelector('h1').textContent = 'Welcome back';
    h.querySelector('p').textContent  = 'Sign in to continue to your workspace.';
    f.innerHTML = 'Don\'t have an account? <a href="#" onclick="switchTab(\'signup\');return false;">Sign up free</a>';
  } else {
    h.querySelector('h1').textContent = 'Create your account';
    h.querySelector('p').textContent  = 'Free forever. No credit card required.';
    f.innerHTML = 'Already have an account? <a href="#" onclick="switchTab(\'login\');return false;">Sign in</a>';
  }
  hideAuthMessage();
};

/* ══════════════════════════════════════════════════════════
   LOGIN
══════════════════════════════════════════════════════════ */

window.login = async function () {
  const email    = (document.getElementById('login-email').value || '').trim();
  const password = document.getElementById('login-password').value || '';

  // ── Validation ──
  if (!email || !password) {
    shakeCard(); showAuthMessage('⚠ Please enter your email and password.', 'error'); return;
  }
  if (!isValidEmail(email)) {
    shakeCard(); showAuthMessage('⚠ Please enter a valid email address.', 'error'); return;
  }

  setBtnLoading('btn-login', true);
  hideAuthMessage();

  try {
    // Step 1: Supabase Auth sign-in
    const { data: authData, error: authError } =
      await supabaseClient.auth.signInWithPassword({ email, password });

    if (authError) {
      showAuthMessage('⚠ ' + mapAuthError(authError.message), 'error');
      shakeCard();
      return;
    }

    const userId = authData.user.id;

    // Step 2: Check is_approved in custom users table
    const { data: userRow, error: dbError } = await supabaseClient
      .from('users')
      .select('is_approved, full_name')
      .eq('id', userId)
      .single();

    if (dbError || !userRow) {
      // Safety: no row = treat as not approved
      await supabaseClient.auth.signOut();
      showAuthMessage(
        '🕐 Your account is <strong>pending admin approval.</strong><br>' +
        'You\'ll receive an email at <strong>' + email + '</strong> once approved.',
        'pending'
      );
      return;
    }

    if (!userRow.is_approved) {
      // Block access & sign out immediately
      await supabaseClient.auth.signOut();
      showAuthMessage(
        '🕐 Your account is <strong>pending admin approval.</strong><br>' +
        'You\'ll receive an email at <strong>' + email + '</strong> once approved.',
        'pending'
      );
      return;
    }

    // Step 3: Approved — enter the app
    showAuthMessage('✓ Signed in! Loading your workspace…', 'success');
    setTimeout(() => {
      document.getElementById('auth-container').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      initApp();
    }, 700);

  } catch (err) {
    showAuthMessage('⚠ Network error. Please check your connection.', 'error');
    console.error('[SprintFlo] Login error:', err);
  } finally {
    setBtnLoading('btn-login', false);
  }
};

/* ══════════════════════════════════════════════════════════
   SIGNUP
══════════════════════════════════════════════════════════ */

window.signup = async function () {
  const name     = (document.getElementById('signup-name').value || '').trim();
  const email    = (document.getElementById('signup-email').value || '').trim();
  const password = document.getElementById('signup-password').value || '';
  const confirm  = document.getElementById('signup-confirm').value || '';

  // ── Validation ──
  if (!name || !email || !password || !confirm) {
    shakeCard(); showAuthMessage('⚠ Please fill in all fields.', 'error'); return;
  }
  if (!isValidEmail(email)) {
    shakeCard(); showAuthMessage('⚠ Please enter a valid email address.', 'error'); return;
  }
  if (password.length < 8) {
    shakeCard(); showAuthMessage('⚠ Password must be at least 8 characters.', 'error'); return;
  }
  if (password !== confirm) {
    shakeCard();
    showAuthMessage('⚠ Passwords do not match. Please re-enter your password.', 'error');
    // Highlight the confirm field
    const cf = document.getElementById('signup-confirm');
    cf.style.borderColor = 'var(--accent)';
    cf.style.boxShadow   = '0 0 0 3px rgba(255,107,107,0.15)';
    setTimeout(() => { cf.style.borderColor = ''; cf.style.boxShadow = ''; }, 2500);
    return;
  }

  setBtnLoading('btn-signup', true);
  hideAuthMessage();

  try {
    // Step 1: Create account in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseClient.auth.signUp({ email, password });

    if (authError) {
      showAuthMessage('⚠ ' + mapAuthError(authError.message), 'error');
      shakeCard();
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      showAuthMessage('⚠ Signup failed. Please try again.', 'error');
      return;
    }

    // Step 2: Insert into custom users table (is_approved defaults to FALSE)
    const { error: insertError } = await supabaseClient
      .from('users')
      .insert({
        id:          userId,
        email:       email,
        full_name:   name,
        is_approved: false   // ← admin must flip this to true
      });

    if (insertError) {
      // Log but don't block — auth row exists, admin can fix table manually
      console.error('[SprintFlo] users table insert error:', insertError);
    }

    // Step 3: Sign out immediately — must wait for approval
    await supabaseClient.auth.signOut();

    // Step 4: Clear form fields
    ['signup-name', 'signup-email', 'signup-password', 'signup-confirm']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('pw-strength-wrap').style.display = 'none';

    // Step 5: Show pending message
    showAuthMessage(
      '✅ <strong>Account created successfully!</strong><br>' +
      'Your account is pending admin approval.<br>' +
      'You\'ll receive an email at <strong>' + email + '</strong> once approved.',
      'pending'
    );

    // Switch back to login tab so user knows where to come back
    setTimeout(() => switchTab('login'), 3000);

  } catch (err) {
    showAuthMessage('⚠ Network error. Please check your connection.', 'error');
    console.error('[SprintFlo] Signup error:', err);
  } finally {
    setBtnLoading('btn-signup', false);
  }
};

/* ══════════════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════════════ */

window.logout = async function () {
  await supabaseClient.auth.signOut();
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-container').style.display = 'flex';
  switchTab('login');
};

/* ══════════════════════════════════════════════════════════
   FORGOT PASSWORD
══════════════════════════════════════════════════════════ */

window.forgotPassword = async function (e) {
  e.preventDefault();
  const email = (document.getElementById('login-email').value || '').trim();
  if (!email || !isValidEmail(email)) {
    showAuthMessage('⚠ Enter your email in the field above first, then click "Forgot?"', 'error');
    document.getElementById('login-email').focus();
    return;
  }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) {
    showAuthMessage('⚠ ' + error.message, 'error');
  } else {
    showAuthMessage('📧 Password reset link sent to <strong>' + email + '</strong>. Check your inbox.', 'success');
  }
};

/* ══════════════════════════════════════════════════════════
   PASSWORD TOGGLE
══════════════════════════════════════════════════════════ */

window.togglePw = function (id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.querySelector('svg').style.opacity = inp.type === 'text' ? '0.4' : '1';
};

/* ══════════════════════════════════════════════════════════
   PASSWORD STRENGTH METER
══════════════════════════════════════════════════════════ */

window.checkPwStrength = function (val) {
  const wrap  = document.getElementById('pw-strength-wrap');
  const label = document.getElementById('pw-strength-label');
  const bars  = [1, 2, 3, 4].map(i => document.getElementById('pb' + i));
  if (!val) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  let score = 0;
  if (val.length >= 8)             score++;
  if (/[A-Z]/.test(val))          score++;
  if (/[0-9]/.test(val))          score++;
  if (/[^A-Za-z0-9]/.test(val))  score++;

  const colors = ['#FF6B6B', '#F59E0B', '#2DD4BF', '#5B2D8E'];
  const labels = ['Weak — add uppercase & numbers', 'Fair — add a symbol', 'Good', 'Strong'];
  bars.forEach((b, i) => b.style.background = i < score ? colors[score - 1] : 'var(--border)');
  label.textContent = labels[score - 1] || '';
  label.style.color = colors[score - 1] || 'var(--text-muted)';
};

/* ══════════════════════════════════════════════════════════
   SHAKE ANIMATION
══════════════════════════════════════════════════════════ */

window.shakeCard = function () {
  const c = document.querySelector('.a-card');
  if (!c) return;
  c.style.animation = 'none';
  c.offsetHeight; // force reflow
  c.style.animation = 'shake 0.38s cubic-bezier(0.36,0.07,0.19,0.97)';
};

/* ══════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════════════════════ */

document.addEventListener('keydown', e => {
  const authWrap = document.getElementById('auth-container');
  if (!authWrap || authWrap.style.display === 'none') return;
  if (e.key === 'Enter') {
    const loginActive = document.getElementById('panel-login')?.classList.contains('active');
    loginActive ? login() : signup();
  }
});
