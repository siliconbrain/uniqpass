const textEncoder = new TextEncoder('utf-8');

function arrayBufferToBase64(buffer) {
    return base64js.fromByteArray(new Uint8Array(buffer));
}

function computeUniqpass(password, site) {
    if (password === "" || site === "") {
        return Promise.resolve("");
    } else {
        return crypto.subtle.digest('SHA-256', textEncoder.encode(password + site)).then(arrayBufferToBase64);
    }
}

const passwordStorageKey = "password";

document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('password');
    const rememberPasswordInput = document.getElementById('remember-password');
    const siteInput = document.getElementById('site');
    const sitePasswordTextArea = document.getElementById('site-password');

    if (localStorage.getItem(passwordStorageKey) !== null) {
        passwordInput.value = localStorage.getItem(passwordStorageKey);
        rememberPasswordInput.checked = true;
        siteInput.focus();
    } else {
        passwordInput.focus();
    }

    function onChange() {
        computeUniqpass(passwordInput.value, siteInput.value).then(uniqpass => {
            sitePasswordTextArea.value = uniqpass;
            if (sitePasswordTextArea.value !== "") sitePasswordTextArea.select();
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