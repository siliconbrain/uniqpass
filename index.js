const textEncoder = new TextEncoder('utf-8');

function arrayBufferToBase64(buffer) {
    return base64js.fromByteArray(new Uint8Array(buffer));
}

function computeUniqpass(password, site, limit) {
    if (password === "" || site === "") {
        return Promise.resolve("");
    } else {
        return crypto.subtle.digest('SHA-256', textEncoder.encode(password + site))
            .then(arrayBufferToBase64)
            .then(pass => pass.substring(0, limit || undefined));
    }
}

const passwordStorageKey = "password";

document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('password');
    const rememberPasswordInput = document.getElementById('remember-password');
    const siteInput = document.getElementById('site');
    const sitePasswordInput = document.getElementById('site-password');

    if (localStorage.getItem(passwordStorageKey) !== null) {
        passwordInput.value = localStorage.getItem(passwordStorageKey);
        rememberPasswordInput.checked = true;
        siteInput.focus();
    } else {
        passwordInput.focus();
    }

    const params = new URLSearchParams(location.search);

    const limitValue = parseInt(params.get('limit'));
    if (isNaN(limitValue) && params.has('limit')) {
        console.warn("'limit' parameter set to invalid value:", params.get('limit'));
    }

    const siteValue = params.get('site');
    if (siteValue) {
        siteInput.value = siteValue;
        onChange();
    }

    function onChange() {
        computeUniqpass(passwordInput.value, siteInput.value, limitValue).then(uniqpass => {
            sitePasswordInput.value = uniqpass;
            if (sitePasswordInput.value !== "") sitePasswordInput.select();
        });
    }

    function rememberPassword() {
        localStorage.setItem(passwordStorageKey, passwordInput.value);
    }

    function forgetPassword() {
        localStorage.removeItem(passwordStorageKey);
    }

    passwordInput.addEventListener('change', () => {
        if (rememberPasswordInput.checked) rememberPassword();
        onChange();
    });
    siteInput.addEventListener('change', onChange);

    rememberPasswordInput.addEventListener('change', () => {
        if (rememberPasswordInput.checked) {
            if (passwordInput.value !== "") rememberPassword();
        } else {
            forgetPassword();
        }
    });
})
